#!/usr/bin/env python3
"""Apply one SQL file to a Supabase project through the Management API.
Usage: apply_migration.py <project-ref> <file.sql>   (needs SUPABASE_ACCESS_TOKEN)"""
import json, os, sys, urllib.request

ref, path = sys.argv[1:3]
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    data=json.dumps({"query": open(path).read()}).encode(),
    headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json", "User-Agent": "goserve-migrate"},
)
print(urllib.request.urlopen(req).read().decode()[:200])
