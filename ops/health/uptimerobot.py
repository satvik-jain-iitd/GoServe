#!/usr/bin/env python3
"""Story H15 (#205): the UptimeRobot monitors GoServe needs. Default is a plan: it READS the monitors you have (getMonitors) and prints which ones are missing.
`--apply` creates the missing ones (newMonitor, HTTP, every 5 minutes) and needs the owner's yes. It never deletes or edits a monitor.
Usage: uptimerobot.py [--apply]   Reads UPTIMEROBOT_API_KEY from the vault. The Telegram alert contact is set by the owner in the UptimeRobot page (F54)."""
import json, pathlib, re, sys, urllib.parse, urllib.request

API = "https://api.uptimerobot.com/v2/"
WANTED = [
    ("GoServe app customer", "https://goserve-app.pages.dev/customer/"),
    ("GoServe app kitchen", "https://goserve-app.pages.dev/kitchen/"),
    ("GoServe app rider", "https://goserve-app.pages.dev/rider/"),
    ("GoServe app admin", "https://goserve-app.pages.dev/admin/"),
    ("GoServe dev customer", "https://goserve-app-dev.vercel.app/customer/"),
    ("GoServe investor site", "https://letsdwelo.in/"),
]
# The n8n health route needs a POST body; the keyword monitor cannot send one, so n8n.linkright.in/healthz stays the only n8n monitor.


def norm(url: str) -> str:
    return url.strip().lower().rstrip("/")


def missing(existing_urls: list[str]) -> list[tuple[str, str]]:
    """The wanted monitors whose address is not monitored yet (compared without case or a trailing slash)."""
    have = {norm(u) for u in existing_urls}
    return [(name, url) for name, url in WANTED if norm(url) not in have]


def new_monitor_body(key: str, name: str, url: str) -> dict:
    return {"api_key": key, "format": "json", "type": 1, "friendly_name": name, "url": url, "interval": 300}


def vault(name: str) -> str:
    for f in pathlib.Path("~/Desktop/Secrets").expanduser().glob("*.env"):
        m = re.search(rf"^{name}=(\S+)", f.read_text(), re.M)
        if m:
            return m.group(1)
    return ""


def call(endpoint: str, body: dict) -> dict:
    req = urllib.request.Request(API + endpoint, data=urllib.parse.urlencode(body).encode(),
                                 headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "goserve-uptime"})
    return json.load(urllib.request.urlopen(req))


if __name__ == "__main__":
    key = vault("UPTIMEROBOT_API_KEY")
    if not key:
        sys.exit("UPTIMEROBOT_API_KEY is not in the vault")
    got = call("getMonitors", {"api_key": key, "format": "json"})
    if got.get("stat") != "ok":
        sys.exit("UptimeRobot did not accept the key: " + json.dumps(got.get("error", got))[:200])
    have = got.get("monitors", [])
    print(f"{len(have)} monitors today:", ", ".join(f"{m['friendly_name']} ({m['url']})" for m in have) or "none")
    todo = missing([m["url"] for m in have])
    print("Missing:", ", ".join(f"{n} ({u})" for n, u in todo) or "none")
    if "--apply" in sys.argv:
        for name, url in todo:
            r = call("newMonitor", new_monitor_body(key, name, url))
            print(("created " if r.get("stat") == "ok" else "FAILED ") + name, "" if r.get("stat") == "ok" else json.dumps(r.get("error", r))[:150])
    else:
        print("Plan only. Add --apply (with the owner's yes) to create the missing monitors.")
