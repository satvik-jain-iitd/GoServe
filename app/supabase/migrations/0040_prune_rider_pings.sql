-- Story #302. The privacy page promises that the history of rider places is deleted after 30 days. Until now only pilot_prune() did it,
-- called by MAIN 90, and MAIN 90 PROD is off. So the database does it itself, every day, with pg_cron: no n8n workflow is needed.
-- 20:30 UTC is 02:00 in India. cron.schedule with a name replaces the job of that name, so this file can run twice.

create extension if not exists pg_cron;

select cron.schedule('goserve-prune-rider-pings', '30 20 * * *', 'select public.pilot_prune()');
