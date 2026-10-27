-- Story #563 (layer 2 of #351). An order change calls /push/notify.
-- The database queues one push job per order status change, by any path, for a customer who has a device (push_devices). It then asks the Edge Function
-- `push` through pg_net, with the function address and our own secret read from the Supabase vault (names push_notify_url and push_notify_secret).
-- The call is made after the commit. It can never break the order change: any failure is swallowed, and the job row is kept so a later sweep can ask again.
-- Prod needs three owner steps first (create the pg_net extension, add the two vault secrets, set PUSH_NOTIFY_SECRET on the function): docs/product/founder-checklist.md.
create extension if not exists pg_net;

create table push_jobs (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  request_id bigint,
  unique (order_id, status)
);
alter table push_jobs enable row level security;
revoke all on push_jobs from public, anon, authenticated;

-- Ask the Edge Function for one job. No address or secret in the vault means nothing is asked (a dev database before the setup).
create function push_job_send(p_job bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  j push_jobs;
  v_url text;
  v_secret text;
  v_req bigint;
begin
  select * into j from push_jobs where id = p_job;
  if j.id is null then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_notify_secret';
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then return; end if;
  select net.http_post(url := v_url, body := jsonb_build_object('order_id', j.order_id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret)) into v_req;
  update push_jobs set request_id = v_req where id = j.id;
end $$;

create function push_jobs_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_job bigint;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if not exists (select 1 from push_devices where session_id = new.session_id) then return new; end if;
  begin
    insert into push_jobs (order_id, status) values (new.id, new.status) on conflict do nothing returning id into v_job;
    if v_job is not null then perform push_job_send(v_job); end if;
  exception when others then
    null;   -- a push must never stop an order from changing
  end;
  return new;
end $$;
create trigger orders_push_jobs after insert or update of status on orders for each row execute function push_jobs_enqueue();

revoke all on function push_job_send(bigint) from public, anon, authenticated;
revoke all on function push_jobs_enqueue() from public, anon, authenticated;
