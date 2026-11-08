-- Story 1067: push_web_done_v2 gets a note, the reason a send failed, for the push_failed trace line.
drop function if exists push_web_done_v2(bigint, int, int);

create or replace function push_web_done_v2(p_outbox bigint, p_sent int, p_failed int, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r push_outbox;
begin
  select * into r from push_outbox where id = p_outbox;
  if r.id is null then return; end if;
  if p_failed > 0 and p_sent = 0 then
    perform trace_write(r.order_id, 'db', 'push_failed', r.status, left('web: ' || p_failed || ' failed, row kept for retry' || coalesce(' (' || p_note || ')', ''), 200), null);
    return;
  end if;
  update push_outbox set sent_at = now() where id = r.id and sent_at is null;
  perform trace_write(r.order_id, 'db', 'push_sent', r.status, 'web: ' || p_sent || ' sent, ' || p_failed || ' failed', null);
end $$;
revoke all on function push_web_done_v2(bigint, int, int, text) from public, anon, authenticated;
grant execute on function push_web_done_v2(bigint, int, int, text) to service_role;
