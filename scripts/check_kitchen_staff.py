#!/usr/bin/env python3
"""Story S-M5 (#132): prove the 0011 policies on a real database. Everything runs in one transaction that is rolled back; nothing stays.
A staff user reads the kitchen's order (placed by another session); a user without a staff row reads zero; the staff table shows each user only their own row.
Usage: check_kitchen_staff.py dev   (needs SUPABASE_ACCESS_TOKEN). Refuses prod."""
import json, os, sys, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"
STAFF, OTHER = "00000000-0000-4000-8000-0000000000a1", "00000000-0000-4000-8000-0000000000b2"


def as_user(uid: str, query: str) -> str:
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {query}; reset role;"


SQL = f"""begin;
insert into kitchens (id, name) values ('00000000-0000-4000-8000-0000000000c1', 'check kitchen');
insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address)
  values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 'someone-elses-session', 'check-1', '[]', 100, 'x');
insert into kitchen_staff (kitchen_id, user_id) values ('00000000-0000-4000-8000-0000000000c1', '{STAFF}');
{as_user(STAFF, "create temp table r1 as select (select count(*) from orders) as orders, (select count(*) from kitchen_staff) as staff")}
{as_user(OTHER, "create temp table r2 as select (select count(*) from orders) as orders, (select count(*) from kitchen_staff) as staff")}
select 'staff' as who, * from r1 union all select 'other', * from r2;
rollback;"""


def run(ref: str, query: str):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-check"})
    return json.load(urllib.request.urlopen(req))


if __name__ == "__main__":
    if sys.argv[1:] != ["dev"]:
        sys.exit("Usage: check_kitchen_staff.py dev (prod is never allowed)")
    rows = {r["who"]: r for r in run(DEV_REF, SQL)}
    print(rows)
    assert rows["staff"]["orders"] >= 1 and rows["staff"]["staff"] == 1, "staff must read the kitchen's order and only their own row"
    assert rows["other"]["orders"] == 0 and rows["other"]["staff"] == 0, "a user without a staff row must read nothing"
    print("OK: staff reads the kitchen's order; a non-staff user reads zero.")
