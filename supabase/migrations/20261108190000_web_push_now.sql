-- Story #1067 (1 of 2). The web push leaves n8n: the alert goes out the moment the outbox row exists, not at the next 30 second tick of MAIN 34.
-- 1. A new outbox row (any path: a status, the rider's Arriving tap, a kitchen opening) asks the Edge Function `push`, route /web, through pg_net, with the address and our own
--    secret from the Supabase vault (the pair that native push uses: push_notify_url ends in /notify, the web route is the same address ending in /web).
--    The call is made after the commit and can never stop an order from changing: any failure is swallowed and the row stays for MAIN 34 (the retry path).
-- 2. push_web_job_v2: the function asks for one row. It marks the row taken (MAIN 34 leaves it alone for 2 minutes) and returns the subscriptions of the customer with the words
--    each phone would have asked for (push_latest), so the words travel inside the encrypted push and the phone does not have to ask.
-- 3. push_web_forget_v2 forgets a subscription the push service says is dead. push_web_done_v2 marks the row sent and writes the trace line push_sent (the end of the clock
--    that starts at push_queued): the before and after numbers of the story come from those two lines.
-- 4. push_web_retry (pg_cron, every minute, the same cron that already prunes rider pings): a row still unsent after a minute is asked again, 3 times at most; older than 10 minutes it is dead. This
--    is the retry path, so MAIN 34 (which only drained and retried) can be switched off once this runs on the database.
-- The claim is atomic: the function and MAIN 34's push_outbox_take both take a row only while taken_at is null (an UPDATE re-checks it under the row lock), so exactly one of them sends.
-- ORDER OF ROLLOUT: the Edge Function with the VAPID secrets first, then this migration. Without the secrets the function answers 503 and the row stays for MAIN 34.

create function push_outbox_ask(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_notify_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_notify_secret';
    if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then return; end if;
    perform net.http_post(url := regexp_replace(v_url, '/notify$', '/web'), body := jsonb_build_object('outbox_id', p_id),
      headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret));
  exception when others then
    null;   -- a push must never stop an order from changing; the row waits for the retry
  end;
end $$;
revoke all on function push_outbox_ask(bigint) from public, anon, authenticated;

create function push_outbox_fire() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform push_outbox_ask(new.id);
  return new;
end $$;
revoke all on function push_outbox_fire() from public, anon, authenticated;
create trigger push_outbox_fire_now after insert on push_outbox for each row execute function push_outbox_fire();

create function push_web_job_v2(p_outbox bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r push_outbox;
  v_subs jsonb;
begin
  select * into r from push_outbox where id = p_outbox and sent_at is null and dead_at is null and taken_at is null for update;
  if r.id is null then return jsonb_build_object('ok', true, 'done', true, 'subscriptions', '[]'::jsonb); end if;   -- sent, dead, or already claimed (by the retry or MAIN 34): nothing to do
  update push_outbox set taken_at = now() where id = r.id;
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'message', push_latest(s.endpoint)) order by s.id), '[]'::jsonb)
    into v_subs from push_subscriptions s where s.session_id = r.session_id;
  return jsonb_build_object('ok', true, 'done', false, 'order_id', r.order_id, 'status', r.status, 'subscriptions', v_subs);
end $$;
revoke all on function push_web_job_v2(bigint) from public, anon, authenticated;
grant execute on function push_web_job_v2(bigint) to service_role;

create function push_web_forget_v2(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;
revoke all on function push_web_forget_v2(text) from public, anon, authenticated;
grant execute on function push_web_forget_v2(text) to service_role;

create function push_web_done_v2(p_outbox bigint, p_sent int, p_failed int) returns void
language plpgsql security definer set search_path = public as $$
declare
  r push_outbox;
begin
  select * into r from push_outbox where id = p_outbox;
  if r.id is null then return; end if;
  if p_failed > 0 and p_sent = 0 then
    perform trace_write(r.order_id, 'db', 'push_failed', r.status, 'web: ' || p_failed || ' failed, row kept for retry', null);
    return;
  end if;
  update push_outbox set sent_at = now() where id = r.id and sent_at is null;
  perform trace_write(r.order_id, 'db', 'push_sent', r.status, 'web: ' || p_sent || ' sent, ' || p_failed || ' failed', null);
end $$;
revoke all on function push_web_done_v2(bigint, int, int) from public, anon, authenticated;
grant execute on function push_web_done_v2(bigint, int, int) to service_role;

create function push_web_retry() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in update push_outbox set dead_at = now() where sent_at is null and dead_at is null and (created_at < now() - interval '10 minutes' or (reoffers >= 3 and taken_at < now() - interval '1 minute'))
           returning order_id, status loop
    if r.order_id is not null then perform trace_write(r.order_id, 'db', 'push_dead', r.status, 'web: not sent', null); end if;
  end loop;
  for r in update push_outbox set taken_at = null, reoffers = reoffers + 1
           where sent_at is null and dead_at is null and taken_at < now() - interval '1 minute' and reoffers < 3 returning id loop
    perform push_outbox_ask(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function push_web_retry() from public, anon, authenticated;
select cron.schedule('goserve-push-retry', '* * * * *', 'select public.push_web_retry()');   -- a named job is replaced, so this file can run twice
