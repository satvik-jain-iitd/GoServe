#!/usr/bin/env python3
"""Story #321 (M.2): prove migration 0041 on the dev database: opening hours are obeyed by place_order, in India time.
One DO block, rolled back by its own final error; nothing stays. Usage: kitchen_hours_check.py dev   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import vault as gsvault
import json, os, re, sys, urllib.error, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"
K1, K2, D1, D2 = ("00000000-0000-4000-8000-0000000009d%d" % i for i in range(1, 5))
IST = "(now() at time zone 'Asia/Kolkata')::time"
SQL = f"""
do $$
declare bad text := ''; e text;
begin
  -- the function itself: 22:59 open, 23:00 closed, overnight, no hours, the switch
  bad := bad || case when kitchen_open_now(true, true, '10:00', '23:00', timestamptz '2026-10-24 17:29:00+00') then '' else '22:59 India must be open; ' end;
  bad := bad || case when not kitchen_open_now(true, true, '10:00', '23:00', timestamptz '2026-10-24 17:30:00+00') then '' else '23:00 India must be closed; ' end;
  bad := bad || case when kitchen_open_now(true, true, '20:00', '02:00', timestamptz '2026-10-24 18:30:00+00') then '' else '00:00 India must be open for an overnight kitchen; ' end;
  bad := bad || case when not kitchen_open_now(true, true, '20:00', '02:00', timestamptz '2026-10-24 20:30:00+00') then '' else '02:00 India must be closed for an overnight kitchen; ' end;
  bad := bad || case when kitchen_open_now(true, true, null, null, now()) and not kitchen_open_now(false, true, null, null, now()) then '' else 'no hours: the switch decides; ' end;
  -- place_order: K1 is open by its switch but its hours are one hour from now to two hours from now (closed now); K2's hours include now
  insert into kitchens (id, name, pin_codes, open, active, opens_at, closes_at) values
    ('{K1}', 'hours closed', '{{110016}}', true, true, date_trunc('minute', {IST}) + interval '1 hour', date_trunc('minute', {IST}) + interval '2 hours'),
    ('{K2}', 'hours open', '{{110016}}', true, true, date_trunc('minute', {IST}) - interval '1 hour', date_trunc('minute', {IST}) + interval '1 hour');
  insert into menu_items (id, kitchen_id, name, price_paise) values ('{D1}', '{K1}', 'd1', 100), ('{D2}', '{K2}', 'd2', 100);
  begin perform place_order('hours-check', 'k1', jsonb_build_array(jsonb_build_object('menu_item_id', '{D1}', 'qty', 1)), 'x'); e := 'ok'; exception when others then e := sqlerrm; end;
  bad := bad || case when e = 'kitchen_closed' then '' else 'a kitchen outside its hours must answer kitchen_closed, got ' || e || '; ' end;
  begin perform place_order('hours-check', 'k2', jsonb_build_array(jsonb_build_object('menu_item_id', '{D2}', 'qty', 1)), 'x'); e := 'ok'; exception when others then e := sqlerrm; end;
  bad := bad || case when e = 'ok' then '' else 'a kitchen inside its hours must take the order, got ' || e || '; ' end;
  raise exception 'HOURS %', case when bad = '' then 'OK' else bad end;
end $$;
"""


def main() -> int:
    if sys.argv[1:] != ["dev"]:
        print("usage: kitchen_hours_check.py dev"); return 2
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{DEV_REF}/database/query", data=json.dumps({"query": SQL}).encode(),
                                 headers={"Authorization": f"Bearer {gsvault.setting(os.environ, 'SUPABASE_ACCESS_TOKEN', '02_databases.env')}", "Content-Type": "application/json", "User-Agent": "goserve-tests"})
    try:
        out = urllib.request.urlopen(req).read().decode()
    except urllib.error.HTTPError as e:
        out = e.read().decode()
    m = re.search(r"HOURS (.*?)\\n", out)
    msg = m.group(0)[:-2] if m else None
    print(msg or out[:700])
    return 0 if msg == "HOURS OK" else 1


if __name__ == "__main__":
    sys.exit(main())
