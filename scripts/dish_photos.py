#!/usr/bin/env python3
"""Story #292 (epic E16): the 12 photos of the one menu every dream kitchen serves, from Openverse (no key needed).
Run: python3 scripts/dish_photos.py dev      (prod: python3 scripts/dish_photos.py prod --yes-prod, the owner's own run)
A person chose the 12 photos by looking at search results; scripts/dish_photo_choices.json holds the Openverse record of each ({"<dish number>": {id, title, creator, license, license_version, url, foreign_landing_url}}), so the script never has to ask Openverse again. Only the
licences cc0, pdm and by are accepted: all three allow commercial use and none is share-alike. The script downloads each file (never hot-links Flickr), makes it at most 600 px wide as WebP under 60 KB, saves it once in the public `menu` bucket as dream/<dish number>.webp, writes one
row per dish to `dish_photos` (title, creator, licence, source page, date) and deletes any other file under dream/. That keeps the bucket at 12 pictures (owner, 25 Oct).
sim_seed (migration 0038) puts the photo on the dish in all ten kitchens again after every Reset.
"""
import vault as gsvault
import io, json, os, re, subprocess, sys, time, urllib.error, urllib.request
from datetime import date
from pathlib import Path

OK_LICENCES = {"cc0", "pdm", "by"}
MAX_BYTES = 60_000
CHOICES = json.loads((Path(__file__).resolve().parent / "dish_photo_choices.json").read_text())


def credit(photo):
    lic, ver = photo["license"], photo.get("license_version") or ""
    if lic not in OK_LICENCES or (lic == "by" and not photo.get("creator")):
        raise ValueError(f"licence not allowed or creator missing: {photo.get('id')} {lic}")
    if lic == "by":
        return f'"{photo["title"]}" by {photo["creator"]}, CC BY {ver}'
    if lic == "cc0":
        return f'{photo.get("creator") or "Unknown"}, CC0'
    return "Public domain"


def row(dish_n, photo, url, today):
    return {"dish_n": dish_n, "image_url": url, "image_credit": credit(photo), "source_page": photo["foreign_landing_url"], "title": photo.get("title") or "",
            "creator": photo.get("creator") or "", "license": photo["license"], "license_version": photo.get("license_version") or "", "fetched_on": today}


def webp_bytes(img):
    """At most 600 px wide, WebP, quality stepping down from 75 until the file is under 60 KB."""
    from PIL import Image
    img = img.convert("RGB")
    img.thumbnail((600, 600))
    for q in (75, 65, 55, 45, 35):
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=q)
        if buf.tell() < MAX_BYTES:
            break
    return buf.getvalue()


def _secret(file, key):
    return re.search(rf"^{key}=(\S+)", gsvault.read(file), re.M).group(1)


def main():
    env = (sys.argv[1] if len(sys.argv) > 1 else "dev").upper()
    if env != "DEV" and "--yes-prod" not in sys.argv:
        sys.exit("prod needs the owner's yes: add --yes-prod")
    from PIL import Image
    base = _secret("02_databases.env", f"SUPABASE_GOSERVE_{env}_URL")
    svc = _secret("02_databases.env", f"SUPABASE_GOSERVE_{env}_SERVICE_ROLE_KEY")
    H = {"apikey": svc, "Authorization": f"Bearer {svc}"}
    UA = {"User-Agent": "goserve-dish-photos"}

    def req(url, data=None, headers=None, method=None):
        for attempt in range(4):   # the database is far away: one slow handshake is not a failure
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers or {}, method=method), timeout=90) as x:
                    return x.read()
            except urllib.error.HTTPError:
                raise
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if attempt == 3:
                    raise
                time.sleep(3)

    def fetch(url):   # curl, not urllib: urllib hung on these hosts from this Mac while curl answered in under a second
        out = subprocess.run(["curl", "-sSL", "-m", "60", "--retry", "2", "-H", "User-Agent: goserve-dish-photos", url], capture_output=True, check=True)
        return out.stdout

    keep = set()
    for n, photo in sorted(CHOICES.items(), key=lambda kv: int(kv[0])):
        c = credit(photo)   # refuses a licence we may not use
        data = webp_bytes(Image.open(io.BytesIO(fetch(photo["url"]))))
        path = f"dream/{n}.webp"
        req(f"{base}/storage/v1/object/menu/{path}", data, {**H, "Content-Type": "image/webp", "x-upsert": "true"}, "POST")
        r = row(int(n), photo, f"{base}/storage/v1/object/public/menu/{path}", date.today().isoformat())
        req(f"{base}/rest/v1/dish_photos?on_conflict=dish_n", json.dumps(r).encode(), {**H, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}, "POST")
        keep.add(path)
        print(f"saved {n:>2} {len(data) // 1000:>3} KB  {c}")
    req(f"{base}/rest/v1/dish_photos?dish_n=not.in.({','.join(CHOICES)})", headers={**H, "Prefer": "return=minimal"}, method="DELETE")   # a dish that lost its photo loses its row
    listing = json.loads(req(f"{base}/storage/v1/object/list/menu", json.dumps({"prefix": "dream", "limit": 1000}).encode(), {**H, "Content-Type": "application/json"}, "POST"))
    stray = [f"dream/{o['name']}" for o in listing if f"dream/{o['name']}" not in keep]
    if stray:
        req(f"{base}/storage/v1/object/menu", json.dumps({"prefixes": stray}).encode(), {**H, "Content-Type": "application/json"}, "DELETE")
    print(f"{len(keep)} pictures in the bucket; removed {len(stray)} others")


if __name__ == "__main__":
    main()
