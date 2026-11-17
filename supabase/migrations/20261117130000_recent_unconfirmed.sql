-- Story 1609 (owner, 17 Nov 2026): a place the customer taps in search is his own recent at once, marked not confirmed (confirmed = false); Confirm on the map
-- updates that same row to confirmed. Ola's terms (see supabase/functions/geocode/index.ts): this is a LOAN, repaid when Ola answers the owner's email in writing.
-- If Ola says no, recent_drop_unconfirmed() deletes every row that was never confirmed; that is the one call to make.
-- The first object of this file is new (recent_drop_unconfirmed) so the prod plan reads the file as not yet applied; create or replace lets the tests run the text again on dev.
-- Additive and safe to run twice. Existing rows stay confirmed (the column default is true).

create or replace function recent_drop_unconfirmed() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from recent_places where confirmed = false;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function recent_drop_unconfirmed() from public, anon, authenticated;

alter table recent_places add column if not exists confirmed boolean not null default true;
