#!/usr/bin/env python3
"""Make a Google user an admin of GoServe (story A1, migration 0013). The user must have signed in with Google once, so auth.users has the email.
Usage: add_admin.py dev|prod <email> [--apply]   Default is a dry run: it prints the SQL and sends nothing.
Reads SUPABASE_ACCESS_TOKEN from the vault. The owner says yes per environment."""
import sys

from add_kitchen_staff import EMAIL, REFS, run


def build_sql(email: str) -> str:
    if not EMAIL.match(email):   # checked here, so nothing odd reaches the SQL text
        raise ValueError("a valid email is needed")
    return f"insert into admins (user_id) select id from auth.users where lower(email) = '{email.lower()}' on conflict do nothing returning user_id"


if __name__ == "__main__":
    env, email = sys.argv[1:3]
    sql = build_sql(email)
    print(f"{env} ({REFS[env]}): {sql}")
    if "--apply" in sys.argv:
        added = run(env, sql)
        print("added:" if added else "no row added (already admin, or no Google user with that email yet):", added)
        print("admins now:", run(env, "select count(*) as admins from admins"))
