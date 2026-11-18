-- Story 1623 (owner, 19 Nov 2026): a tapped search result is my recent at once. When Ola gives no postal code, the row keeps pin_code null until it is confirmed.
-- source tells who gave the row: 'ola' (Ola Maps' answer, a loan) or 'own' (ours). Old rows keep null.
-- recent_drop_ola() is the Ola loan's undo: one call deletes every row Ola gave us. It is not called here.
-- The first object of this file is recent_drop_ola (the prod plan reads it as the proof of this file).
-- Additive and safe to run twice.

create or replace function recent_drop_ola() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from recent_places where source = 'ola';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function recent_drop_ola() from public, anon, authenticated;

alter table recent_places add column if not exists source text check (source is null or source in ('ola', 'own'));

alter table recent_places alter column pin_code drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recent_places_confirmed_has_pin' and conrelid = 'public.recent_places'::regclass) then
    alter table recent_places add constraint recent_places_confirmed_has_pin check (not confirmed or pin_code is not null);
  end if;
end $$;
