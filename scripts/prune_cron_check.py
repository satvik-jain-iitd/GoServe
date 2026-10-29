#!/usr/bin/env python3
"""Story #302: prove migration 0040 on the dev database. The privacy page promises that rider place history is deleted after 30 days, so the database
itself must do it every day (pg_cron), without any n8n workflow. One DO block, rolled back by its own final error; nothing stays.
Usage: prune_cron_check.py dev   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import vault as gsvault
import json, os, re, sys, urllib.error, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"
U = "00000000-0000-4000-8000-0000000009c1"
SQL = f"""
do $$
declare bad text := ''; j record; n int;
begin
  select * into j from cron.job where jobname = 'goserve-prune-rider-pings';
  if j.jobid is null then raise exception 'PRUNE no job named goserve-prune-rider-pings'; end if;
  bad := bad || case when j.schedule = '30 20 * * *' then '' else 'schedule is ' || j.schedule || '; ' end;   -- 02:00 India
  bad := bad || case when j.command ilike '%pilot_prune()%' then '' else 'command is ' || j.command || '; ' end;
  bad := bad || case when j.active then '' else 'job is not active; ' end;
  insert into rider_pings (user_id, at, lat, lng) values ('{U}', now() - interval '31 days', 28.6, 77.2), ('{U}', now() - interval '29 days', 28.6, 77.2), ('{U}', now(), 28.6, 77.2);
  execute j.command;
  select count(*) into n from rider_pings where user_id = '{U}';
  bad := bad || case when n = 2 then '' else 'after the job ' || n || ' pings are left, wanted 2; ' end;
  raise exception 'PRUNE %', case when bad = '' then 'OK' else bad end;
end $$;
"""


def main() -> int:
    if sys.argv[1:] != ["dev"]:
        print("usage: prune_cron_check.py dev"); return 2
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{DEV_REF}/database/query", data=json.dumps({"query": SQL}).encode(),
                                 headers={"Authorization": f"Bearer {gsvault.setting(os.environ, 'SUPABASE_ACCESS_TOKEN', '02_databases.env')}", "Content-Type": "application/json", "User-Agent": "goserve-tests"})
    try:
        out = urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e:
        out = e.read().decode()
    m = re.search(r"PRUNE (.*?)\\n", out)
    msg = m.group(0)[:-2] if m else None
    print(msg or out[:600])
    return 0 if msg == "PRUNE OK" else 1


if __name__ == "__main__":
    sys.exit(main())
