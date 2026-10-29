-- Story #356 (E27, plan v2 B.20). Run log on v2: every Edge Function call leaves one run_log row (supabase/functions/_shared/runlog.ts).
-- A failed call carries its error code and a request id, which the answer also returns in the x-request-id header, so a customer's report can be found.
-- v2 calls have no kitchen at the door (quote, serviceability), so kitchen_id may be empty. Today's n8n rows are unchanged (they still fill it).
alter table run_log
  add column request_id text,
  add column status integer,
  alter column kitchen_id drop not null;
create index run_log_request on run_log (request_id) where request_id is not null;
