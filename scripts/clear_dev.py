#!/usr/bin/env python3
"""Clear the test data on goserve-dev (F71): orders, their events, decisions, run logs and session links.
Dry run by default: it only prints the counts. --apply deletes. It refuses any project other than goserve-dev.
Events are frozen except while the transaction sets goserve.reset (migration 0006), the same door reset_session uses.
Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env). Usage: clear_dev.py [--apply] [--ref <ref>]"""
import json, os, sys, urllib.request

DEV_REF = "tmxyizmkpwwfyazvrfhw"  # goserve-dev
TABLES = ["order_events", "decision_log", "run_log", "orders", "session_links"]  # children first


def sql(ref, query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-clear-dev"},
    )
    return json.load(urllib.request.urlopen(req))


def counts_query():
    return "select " + ", ".join(f"(select count(*) from {t}) as {t}" for t in TABLES)


def main(argv):
    ref = argv[argv.index("--ref") + 1] if "--ref" in argv else DEV_REF
    if ref != DEV_REF:
        sys.exit(f"Refused: {ref} is not goserve-dev ({DEV_REF}).")
    print("Now:", sql(ref, counts_query())[0])
    if "--apply" not in argv:
        print("Dry run. Nothing deleted. Add --apply to clear these tables.")
        return
    sql(ref, "begin; select set_config('goserve.reset', 'on', true); " + "; ".join(f"delete from {t}" for t in TABLES) + "; commit;")
    print("After:", sql(ref, counts_query())[0])


if __name__ == "__main__":
    main(sys.argv[1:])
