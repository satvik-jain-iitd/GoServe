#!/usr/bin/env python3
"""Story #322 (M.3): prove migration 0042 on the dev database: the demo city serves the founder's own pin codes (110016, 110017, 110029).
One DO block, rolled back by its own final error; nothing stays. Usage: pins_check.py dev   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import json, os, re, sys, urllib.error, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"
SQL = """
do $$
declare bad text := ''; pin text; n int;
begin
  perform sim_reset();
  perform sim_seed('{}'::jsonb);
  foreach pin in array array['110016', '110017', '110029'] loop
    select count(*) into n from kitchens where synthetic and open and active and pin = any (pin_codes);
    bad := bad || case when n >= 1 then '' else pin || ' has no open demo kitchen; ' end;
  end loop;
  select count(*) into n from kitchens where synthetic;
  bad := bad || case when n = 10 then '' else 'the city must still have 10 kitchens, has ' || n || '; ' end;
  raise exception 'PINS %', case when bad = '' then 'OK' else bad end;
end $$;
"""


def main() -> int:
    if sys.argv[1:] != ["dev"]:
        print("usage: pins_check.py dev"); return 2
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{DEV_REF}/database/query", data=json.dumps({"query": SQL}).encode(),
                                 headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-tests"})
    try:
        out = urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e:
        out = e.read().decode()
    m = re.search(r"PINS (.*?)\\n", out)
    msg = m.group(0)[:-2] if m else None
    print(msg or out[:700])
    return 0 if msg == "PINS OK" else 1


if __name__ == "__main__":
    sys.exit(main())
