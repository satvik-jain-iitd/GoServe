#!/usr/bin/env python3
"""Story #253: prove migration 0039 (the daily Jev cap) on the dev database. One DO block, rolled back by its own final error; nothing stays.
Usage: jev_cap_check.py dev   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import vault as gsvault
import json, os, re, sys, urllib.error, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"
ADMIN, OTHER = "00000000-0000-4000-8000-0000000009a1", "00000000-0000-4000-8000-0000000009a2"
K = "00000000-0000-4000-8000-0000000009b1"
ROW = "insert into decision_log (kitchen_id, decision, created_at) values ('{k}', '{d}'::jsonb, {at});"
DAY = "(date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')"   # 00:00 India today
SQL = f"""
do $$
declare r jsonb; bad text := '';
begin
  insert into kitchens (id, name, pin_codes) values ('{K}', 'cap check', '{{110016}}');
  insert into admins (user_id) values ('{ADMIN}');
  r := decision_gate();
  bad := bad || case when r->>'engine' = 'rules' and (r->>'jev_cap')::int = 0 and (r->>'jev_used')::int = 0 then '' else 'default is rules, cap 0, used 0; ' end;
  begin perform set_config('request.jwt.claim.sub', '{OTHER}', true); set local role authenticated; perform set_jev_daily_cap(5); reset role; bad := bad || 'non-admin may set; ';
  exception when others then reset role; if sqlerrm <> 'not_admin' then bad := bad || 'non-admin error is ' || sqlerrm || '; '; end if; end;
  set local role authenticated; perform set_config('request.jwt.claim.sub', '{ADMIN}', true);
  r := set_jev_daily_cap(5); reset role;
  bad := bad || case when (r->>'jev_cap')::int = 5 then '' else 'admin set 5; ' end;
  bad := bad || case when (decision_gate()->>'jev_cap')::int = 5 and (select count(*) from params where session_id = 'global' and key = 'jev_daily_cap') = 2 then '' else 'gate reads 5 and a second version exists; ' end;
  begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{ADMIN}', true); perform set_jev_daily_cap(-1); reset role; bad := bad || '-1 allowed; ';
  exception when others then reset role; if sqlerrm <> 'invalid_cap' then bad := bad || '-1 error is ' || sqlerrm || '; '; end if; end;
  begin set local role authenticated; perform set_config('request.jwt.claim.sub', '{ADMIN}', true); perform set_jev_daily_cap(100001); reset role; bad := bad || 'huge cap allowed; ';
  exception when others then reset role; if sqlerrm <> 'invalid_cap' then bad := bad || 'huge cap error is ' || sqlerrm || '; '; end if; end;
  {ROW.format(k=K, d='{"engine":"jev","jev_status":"ok","jev":{"cost":0.00004}}', at=DAY + " + interval '1 hour'")}
  {ROW.format(k=K, d='{"engine":"jev","jev_status":"jev_error","jev":null}', at="now()")}
  {ROW.format(k=K, d='{"engine":"jev","jev_status":"jev_daily_cap","jev":null}', at="now()")}
  {ROW.format(k=K, d='{"engine":"rules","jev_status":"engine_rules","jev":null}', at="now()")}
  {ROW.format(k=K, d='{"engine":"jev","jev_status":"ok","jev":{"cost":0.5}}', at=DAY + " - interval '1 hour'")}
  r := decision_gate();
  bad := bad || case when (r->>'jev_used')::int = 2 then '' else 'used counts today''s real Jev calls only (got ' || (r->>'jev_used') || '); ' end;
  r := health_numbers()->'ai';
  bad := bad || case when (r->>'jev_calls_today')::int = 2 and (r->>'jev_cap')::int = 5 and abs((r->>'jev_cost_today')::numeric - 0.00004) < 1e-9 then '' else 'health ai block is ' || coalesce(r::text, 'missing') || '; ' end;
  begin set local role authenticated; perform decision_gate(); reset role; bad := bad || 'signed-in user may read the gate; ';
  exception when others then reset role; end;
  raise exception 'JEVCAP %', case when bad = '' then 'OK' else bad end;
end $$;
"""


def main() -> int:
    if sys.argv[1:] != ["dev"]:
        print("usage: jev_cap_check.py dev"); return 2
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{DEV_REF}/database/query", data=json.dumps({"query": SQL}).encode(),
                                 headers={"Authorization": f"Bearer {gsvault.setting(os.environ, 'SUPABASE_ACCESS_TOKEN', '02_databases.env')}", "Content-Type": "application/json", "User-Agent": "goserve-tests"})
    try:
        out = urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e:
        out = e.read().decode()
    m = re.search(r"JEVCAP (.*?)\\n", out)
    msg = m.group(0)[:-2] if m else None
    print(msg or out[:600])
    return 0 if msg == "JEVCAP OK" else 1


if __name__ == "__main__":
    sys.exit(main())
