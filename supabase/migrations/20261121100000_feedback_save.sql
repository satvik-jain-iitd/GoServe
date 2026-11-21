-- Story 1750 (epic #1299). A signed-in person saves his own report from the Feedback sheet, with no n8n in the path.
-- The table `feedback` is closed (RLS on, no write policy); this one function is the way in. session_id is always auth.uid(), never what the caller sends.
-- It answers { ok: true, id } or { ok: false, error, message } with a named refusal. Dev only until the release (rule: prod waits for the owner's own yes).
-- The screen name is capped at 80 letters (a named refusal, not a cut). The 10 per hour count can be passed by two calls at the same instant (accepted); it scans by session_id with no index (fine at this size).
-- A guest (anonymous sign-in) counts as a customer. A guest can get a fresh limit of 10 by making a new session: accepted for now.
-- The first object of this file is new (feedback_save_v2) so the prod plan reads the file as not yet applied; create or replace lets the tests run the text again on dev.
create or replace function feedback_save_v2(p_role text, p_screen text, p_order uuid, p_doing text, p_text text, p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
  v_kitchen uuid;
  v_ctx jsonb := coalesce(p_context, '{}'::jsonb);
  v_id uuid;
  v_has boolean;
  v_ok boolean := true;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in', 'message', 'Sign in to send a note.');
  end if;
  if p_role is null or p_role not in ('customer', 'kitchen', 'rider', 'ops', 'console')
     or p_doing is null or p_doing not in ('ordering', 'cooking', 'delivering', 'watching ops', 'installing', 'other')
     or coalesce(btrim(p_screen), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_role_or_doing', 'message', 'This note could not be read.');
  end if;
  if char_length(btrim(p_screen)) > 80 then
    return jsonb_build_object('ok', false, 'error', 'screen_too_long', 'message', 'This note could not be sent.');
  end if;
  if char_length(v_text) = 0 then
    return jsonb_build_object('ok', false, 'error', 'text_empty', 'message', 'Write a few words first.');
  end if;
  if char_length(v_text) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'text_too_long', 'message', 'Keep the note under 2000 letters.');
  end if;
  if jsonb_typeof(v_ctx) <> 'object' or octet_length(v_ctx::text) > 8192 then
    return jsonb_build_object('ok', false, 'error', 'context_too_big', 'message', 'This note could not be sent.');
  end if;

  -- the role the caller really has
  if p_role = 'kitchen' then
    select exists (select 1 from kitchen_staff where user_id = v_me) into v_has;
  elsif p_role = 'rider' then
    select exists (select 1 from riders where user_id = v_me) into v_has;
  elsif p_role in ('ops', 'console') then
    v_has := coalesce(is_admin(), false);
  else
    v_has := true;   -- customer: any signed-in person, a guest too
  end if;
  if not v_has then
    return jsonb_build_object('ok', false, 'error', 'role_not_yours', 'message', 'This note could not be sent.');
  end if;

  -- the order, if one is named: the caller's own (customer), of his kitchen (kitchen), assigned to him (rider), any (admin)
  if p_order is not null then
    if coalesce(is_admin(), false) then
      select kitchen_id into v_kitchen from orders where id = p_order;
      v_ok := found;
    elsif p_role = 'customer' then
      select kitchen_id into v_kitchen from orders where id = p_order and session_id = v_me::text;
      v_ok := found;
    elsif p_role = 'kitchen' then
      select o.kitchen_id into v_kitchen from orders o where o.id = p_order and o.kitchen_id in (select kitchen_id from kitchen_staff where user_id = v_me);
      v_ok := found;
    elsif p_role = 'rider' then
      select kitchen_id into v_kitchen from orders where id = p_order and rider_id = v_me;
      v_ok := found;
    else
      v_ok := false;
    end if;
    if not v_ok then
      return jsonb_build_object('ok', false, 'error', 'order_not_yours', 'message', 'That order is not yours.');
    end if;
  end if;
  if v_kitchen is null and p_role = 'kitchen' then
    select kitchen_id into v_kitchen from kitchen_staff where user_id = v_me order by created_at limit 1;
  end if;

  if (select count(*) from feedback where session_id = v_me::text and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many', 'message', 'You have sent a lot of notes. Try again in an hour.');
  end if;

  insert into feedback (kitchen_id, session_id, role, screen, order_id, doing, text, context)
  values (v_kitchen, v_me::text, p_role, btrim(p_screen), p_order, p_doing, v_text, v_ctx)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function feedback_save_v2(text, text, uuid, text, text, jsonb) from public, anon;
grant execute on function feedback_save_v2(text, text, uuid, text, text, jsonb) to authenticated;
