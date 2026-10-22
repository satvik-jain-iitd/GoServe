#!/usr/bin/env python3
"""List a Google user as staff of a kitchen (story S-M5, migration 0011). The user must have signed in with Google once, so auth.users has the email.
Usage: add_kitchen_staff.py dev|prod <email> <kitchen_id> [--apply]   Default is a dry run: it prints the SQL and sends nothing.
Reads SUPABASE_ACCESS_TOKEN from the vault. The owner says yes per environment."""
import json, pathlib, re, sys, urllib.request

REFS = {"dev": "tmxyizmkpwwfyazvrfhw", "prod": "vpuumnslnionplrxmqlf"}
EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def build_sql(email: str, kitchen_id: str) -> str:
    if not EMAIL.match(email) or not UUID.match(kitchen_id):   # checked here, so nothing odd reaches the SQL text
        raise ValueError("a valid email and a kitchen id (uuid) are needed")
    return (f"insert into kitchen_staff (kitchen_id, user_id) select '{kitchen_id}', id from auth.users where lower(email) = '{email.lower()}' "
            "on conflict do nothing returning kitchen_id, user_id")


def vault(name: str) -> str:
    for f in pathlib.Path("~/Desktop/Secrets").expanduser().glob("*.env"):
        m = re.search(rf"^{name}=(\S+)", f.read_text(), re.M)
        if m:
            return m.group(1)
    return ""


def run(env: str, query: str):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REFS[env]}/database/query", data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {vault('SUPABASE_ACCESS_TOKEN')}", "Content-Type": "application/json", "User-Agent": "goserve-staff"})
    return json.load(urllib.request.urlopen(req))


if __name__ == "__main__":
    env, email, kitchen = sys.argv[1:4]
    sql = build_sql(email, kitchen)
    print(f"{env} ({REFS[env]}): {sql}")
    if "--apply" in sys.argv:
        added = run(env, sql)
        print("added:" if added else "no row added (already staff, or no Google user with that email yet):", added)
        print("now:", run(env, f"select kitchen_id, user_id from kitchen_staff where kitchen_id = '{kitchen}'"))
