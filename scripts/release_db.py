#!/usr/bin/env python3
"""Put the database on the PROD project (story #78): every migration in order, anonymous sign-in on, then checks.
Dry run by default: it only reads and prints the plan. --apply writes. It refuses goserve-dev and any database that already has tables.
The prod address comes from SUPABASE_GOSERVE_PROD_URL, the token from SUPABASE_ACCESS_TOKEN (vault 02_databases.env).
Usage: release_db.py [--apply]   (the owner says yes before --apply)"""
import glob, json, os, sys, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"  # goserve-dev: never touched here
HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://api.supabase.com/v1/projects"
APP_TABLES = {"kitchens", "menu_items", "orders", "order_events", "decision_log", "run_log", "params", "session_links", "feedback"}


def _call(method, ref, path, body=None):
    req = urllib.request.Request(f"{API}/{ref}{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-release"})
    body = urllib.request.urlopen(req).read()
    return json.loads(body) if body.strip() else {}   # some calls (set secrets) answer 2xx with nothing


def sql(ref, query):
    return _call("POST", ref, "/database/query", {"query": query})


def project_name(ref):
    return _call("GET", ref, "")["name"]


def get_auth(ref):
    return _call("GET", ref, "/config/auth")


def set_auth(ref):
    _call("PATCH", ref, "/config/auth", {"external_anonymous_users_enabled": True})


def ref_from_url(url):
    return url.split("//")[1].split(".")[0]


def migration_files():
    return sorted(glob.glob(os.path.join(HERE, "..", "app", "supabase", "migrations", "*.sql")))


def main(argv, env=os.environ):
    ref = ref_from_url(env["SUPABASE_GOSERVE_PROD_URL"])
    if ref == DEV_REF:
        sys.exit("Refused: this is goserve-dev. This script is for the production project only.")
    name = project_name(ref)   # the owner's yes goes to a NAME, not only a ref
    if "goserve" not in name.lower() or "dev" in name.lower():
        sys.exit(f"Refused: the project name is {name!r}; the prod project is called GoServe. Check SUPABASE_GOSERVE_PROD_URL.")
    files = migration_files()
    have = {r["table_name"] for r in sql(ref, "select table_name from information_schema.tables where table_schema = 'public'")}
    print(f"Prod project {name!r} ({ref}): {len(have)} tables now. Plan: " + ", ".join(os.path.basename(f) for f in files) + ", then anonymous sign-in on.")
    print("Anonymous sign-in is", "ON" if get_auth(ref).get("external_anonymous_users_enabled") else "OFF")
    if "--apply" not in argv:
        print("Dry run. Nothing written. Add --apply (after the owner's yes) to run the plan.")
        return
    if have & APP_TABLES:
        sys.exit(f"Refused: the database is not empty ({sorted(have & APP_TABLES)}). Stop and ask the owner.")
    for f in files:
        sql(ref, open(f).read())
        print("applied", os.path.basename(f))
    set_auth(ref)
    print("anonymous sign-in switched on")
    r = sql(ref, "select (select count(*) from menu_items) as dishes, (select count(*) from information_schema.tables where table_schema = 'public') as tables, "
                 "(select count(*) from pg_policies where schemaname = 'public') as policies")[0]
    if (r["dishes"], r["tables"], r["policies"]) != (10, len(APP_TABLES), 6) or not get_auth(ref).get("external_anonymous_users_enabled"):
        sys.exit(f"Check failed: {r}. Look at the prod project before going on.")
    print("Checks passed:", r)


if __name__ == "__main__":
    main(sys.argv[1:])
