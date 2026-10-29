#!/usr/bin/env python3
"""Turn on Google sign-in and manual identity linking in a Supabase project (story S-M1, ADR-016).
Usage: set_google_auth.py dev|prod [--apply]   Default is a dry run: it prints what it would send, never the secret.
Reads SUPABASE_ACCESS_TOKEN and GOSERVE_GOOGLE_OAUTH_CLIENT_ID / _SECRET from the vault."""
import json, os, pathlib, re, sys, urllib.request

REFS = {"dev": "tmxyizmkpwwfyazvrfhw", "prod": "vpuumnslnionplrxmqlf"}
SITES = {"dev": "https://goserve-app-dev.vercel.app", "prod": "https://goserve-app.pages.dev"}


def build_payload(env: str, client_id: str, secret: str) -> dict:
    if not client_id or not secret:
        raise ValueError("the Google client id and secret are both needed")
    allow = [SITES[env] + "/**"] + (["http://localhost:5173/**"] if env == "dev" else [])   # without these the phone lands on localhost after Google
    return {"external_google_enabled": True, "external_google_client_id": client_id, "external_google_secret": secret,
            "security_manual_linking_enabled": True, "site_url": SITES[env], "uri_allow_list": ",".join(allow)}


def plan(env: str, payload: dict) -> str:
    shown = {k: ("<hidden>" if "secret" in k else v) for k, v in payload.items()}
    return f"PATCH https://api.supabase.com/v1/projects/{REFS[env]}/config/auth {json.dumps(shown)}"


def vault(name: str) -> str:
    root = pathlib.Path("~/Desktop/Secrets").expanduser()
    for f in sorted((root / "goserve").glob("*.env")) + sorted(root.glob("*.env")):   # the goserve folder first (owner, 29 Oct 2026), then the old shared files
        m = re.search(rf"^{name}=(\S+)", f.read_text(), re.M)
        if m:
            return m.group(1)
    return ""


if __name__ == "__main__":
    env = sys.argv[1]
    payload = build_payload(env, vault("GOSERVE_GOOGLE_OAUTH_CLIENT_ID"), vault("GOSERVE_GOOGLE_OAUTH_CLIENT_SECRET"))
    print(plan(env, payload))
    if "--apply" in sys.argv:
        req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REFS[env]}/config/auth", method="PATCH",
                                     data=json.dumps(payload).encode(),
                                     headers={"Authorization": f"Bearer {vault('SUPABASE_ACCESS_TOKEN')}", "Content-Type": "application/json", "User-Agent": "goserve-auth"})
        print(urllib.request.urlopen(req).status)
