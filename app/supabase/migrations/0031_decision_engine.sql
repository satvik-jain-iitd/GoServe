-- Story #263 (epic E22), layer 1. The admin picks who makes the live rider decisions: Rules, Jev or Laya. Exactly one is on.
-- One setting, params global/decision_engine, versioned: the latest version wins, like sim_enabled. Every change is a new row with who made it.
-- The two functions run with the CALLER's sign-in (n8n forwards the admin's token): is_admin() decides. Laya is refused until it is deployed (#253).

insert into params (kitchen_id, session_id, key, value, version)
values (null, 'global', 'decision_engine', '{"engine":"rules","by":"system"}', 1)
on conflict (session_id, key, version) do nothing;

create or replace function get_decision_engine()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_row params;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  select * into v_row from params where session_id = 'global' and key = 'decision_engine' order by version desc limit 1;
  return jsonb_build_object('ok', true, 'engine', coalesce(v_row.value ->> 'engine', 'rules'), 'version', coalesce(v_row.version, 1),
    'changed_at', v_row.created_at, 'by', coalesce(v_row.value ->> 'by', 'system'),
    'engines', jsonb_build_object('rules', true, 'jev', true, 'laya', false));
end $$;

create or replace function set_decision_engine(p_engine text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now text; v_by text;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  if p_engine = 'laya' then raise exception 'laya_not_deployed'; end if;
  if p_engine is null or p_engine not in ('rules', 'jev') then raise exception 'invalid_engine'; end if;
  select value ->> 'engine' into v_now from params where session_id = 'global' and key = 'decision_engine' order by version desc limit 1;
  if v_now is distinct from p_engine then   -- the same engine again writes nothing
    select coalesce(email, id::text) into v_by from auth.users where id = auth.uid();
    insert into params (kitchen_id, session_id, key, value, version)
    values (null, 'global', 'decision_engine', jsonb_build_object('engine', p_engine, 'by', coalesce(v_by, 'admin')),
            coalesce((select max(version) from params where session_id = 'global' and key = 'decision_engine'), 0) + 1);
  end if;
  return get_decision_engine();
end $$;

revoke all on function get_decision_engine() from public, anon;
revoke all on function set_decision_engine(text) from public, anon;
grant execute on function get_decision_engine() to authenticated;
grant execute on function set_decision_engine(text) to authenticated;
