#!/usr/bin/env python3
"""Story #252 / experiment E-TWA-1: with the rider app open and the screen off, how long is the longest wait between two pings?
Run: python3 scripts/rider_gap.py dev|prod [--minutes 20] [--yes-prod]      (read only: it reads rider_pings through the service key in the vault)
Prints the pings of the last N minutes per rider, the longest gap in seconds, and PASS when no gap is over 60 s (the story's line)."""
import vault as gsvault
import json, os, re, sys, urllib.request
from datetime import datetime, timedelta, timezone

LIMIT_S = 60


def _t(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def max_gap(times):
    ts = sorted(_t(t) for t in times)
    return None if len(ts) < 2 else round(max((b - a).total_seconds() for a, b in zip(ts, ts[1:])))


def verdict(gap):
    return "PASS" if gap is not None and gap <= LIMIT_S else "FAIL"


def main():
    env = (sys.argv[1] if len(sys.argv) > 1 else "dev").upper()
    if env != "DEV" and "--yes-prod" not in sys.argv:
        sys.exit("prod needs the owner's yes: add --yes-prod")
    minutes = int(sys.argv[sys.argv.index("--minutes") + 1]) if "--minutes" in sys.argv else 20
    vault = gsvault.read("02_databases.env")
    url = re.search(rf"^SUPABASE_GOSERVE_{env}_URL=(\S+)", vault, re.M).group(1)
    key = re.search(rf"^SUPABASE_GOSERVE_{env}_SERVICE_ROLE_KEY=(\S+)", vault, re.M).group(1)
    since = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")
    req = urllib.request.Request(f"{url}/rest/v1/rider_pings?select=user_id,at&at=gte.{since}&order=at", headers={"apikey": key, "Authorization": f"Bearer {key}"})
    rows = json.loads(urllib.request.urlopen(req, timeout=60).read())
    by = {}
    for r in rows:
        by.setdefault(r["user_id"], []).append(r["at"])
    if not by:
        print(f"No pings in the last {minutes} minutes. FAIL")
    for uid, ts in by.items():
        g = max_gap(ts)
        print(f"rider {uid[:8]}: {len(ts)} pings, longest gap {g} s, {verdict(g)}")


if __name__ == "__main__":
    main()
