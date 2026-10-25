#!/usr/bin/env python3
"""Story #292 (epic E16): a real photo for every dish of the ten dream kitchens, from Pexels (free commercial use, credit kept).
Run: PEXELS_API_KEY in ~/Desktop/Secrets/04_integrations.env, then  python3 scripts/dish_photos.py dev [--sheet DIR] [--only N]
For each dish it searches Pexels, keeps a photo only if its alt text names the dish (no wrong photo of the wrong dish), resizes it to 800 px,
saves it in the public `menu` bucket as dream/<kitchen>-<dish>.jpg, and writes one row to `dish_photos` (source page, photographer, licence, date).
sim_seed (migration 0038) puts the photo on the dish again after every Reset. Prod needs the owner's own run: `dish_photos.py prod --yes-prod`.
"""
import hashlib, io, json, math, os, re, sys, time, urllib.parse, urllib.request
from datetime import date

STOP = {"a", "an", "the", "of", "with", "and", "ka", "ki", "in", "on"}
# Words Pexels does not know, or know under another name. Everything else is searched by its own name.
BETTER = {"ven pongal": "pongal south indian breakfast", "tingmo": "tibetan steamed bun", "laphing": "laphing tibetan cold noodles",
          "shaphale": "tibetan fried meat pie shaphale", "sheermal": "sheermal flatbread", "roomali roti": "roomali roti"}


def query_for(name):
    q = re.sub(r"\s*\([^)]*\)", "", name).strip().lower()
    return BETTER.get(q, q)


def _words(text):
    return [w for w in re.findall(r"[a-z]+", text.lower()) if w not in STOP]


def pick(results, query):
    """The best landscape photo whose alt text names at least half of the dish's words; None when none does."""
    need = _words(query)
    best, best_score = None, 0
    for p in results:
        alt = set(_words(p.get("alt") or ""))
        score = sum(1 for w in need if w in alt)
        if not need or score < max(1, math.ceil(len(need) / 2)):
            continue
        land = p.get("width", 0) >= p.get("height", 1)
        score = score * 2 + (1 if land else -3)
        if score > best_score:
            best, best_score = p, score
    return best


def find(name, search):
    q = query_for(name)
    return pick(search(q), q)


def credit(photo):
    return f"{photo['photographer']} on Pexels"


def row(kitchen_n, dish_n, photo, url, today):
    return {"kitchen_n": kitchen_n, "dish_n": dish_n, "image_url": url, "image_credit": credit(photo), "source_page": photo["url"],
            "photographer": photo["photographer"], "licence": "Pexels licence", "fetched_on": today}


# ---- the part that talks to the network (not unit tested; run it and look at the sheet) ----
def _secret(file, key):
    return re.search(rf"^{key}=(\S+)", open(os.path.expanduser(f"~/Desktop/Secrets/{file}")).read(), re.M).group(1)


def main():
    env = (sys.argv[1] if len(sys.argv) > 1 else "dev").upper()
    if env != "DEV" and "--yes-prod" not in sys.argv:
        sys.exit("prod needs the owner's yes: add --yes-prod")
    only = int(sys.argv[sys.argv.index("--only") + 1]) if "--only" in sys.argv else None
    sheet = sys.argv[sys.argv.index("--sheet") + 1] if "--sheet" in sys.argv else None
    from PIL import Image, ImageDraw   # only this script needs Pillow
    key = _secret("04_integrations.env", "PEXELS_API_KEY")
    base = _secret("02_databases.env", f"SUPABASE_GOSERVE_{env}_URL")
    svc = _secret("02_databases.env", f"SUPABASE_GOSERVE_{env}_SERVICE_ROLE_KEY")
    H = {"apikey": svc, "Authorization": f"Bearer {svc}"}

    def req(url, data=None, headers=None, method=None):
        r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        with urllib.request.urlopen(r, timeout=60) as x:
            return x.read()

    def search(q):
        time.sleep(0.4)
        url = "https://api.pexels.com/v1/search?" + urllib.parse.urlencode({"query": q, "per_page": 15, "orientation": "landscape"})
        return json.loads(req(url, headers={"Authorization": key, "User-Agent": "goserve-dish-photos"}))["photos"]

    rest = lambda path: json.loads(req(f"{base}/rest/v1/{path}", headers=H))
    ids = {hashlib.md5(f"dream-kitchen-{n}".encode()).hexdigest(): n for n in range(1, 30)}
    kitchens = {k["id"].replace("-", ""): k for k in rest("kitchens?select=id,name&synthetic=eq.true")}
    dishes = rest("menu_items?select=name,sort,kitchen_id&synthetic=eq.true&order=kitchen_id,sort")
    tiles, missing = [], []
    for d in dishes:
        n = ids.get(d["kitchen_id"].replace("-", ""))
        if n is None or (only and n != only):
            continue
        photo = find(d["name"], search)
        if not photo:
            missing.append((n, d["sort"], d["name"]))
            continue
        img = Image.open(io.BytesIO(req(photo["src"]["large"]))).convert("RGB")
        img.thumbnail((800, 800))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=80)
        path = f"dream/{n}-{d['sort']}.jpg"
        req(f"{base}/storage/v1/object/menu/{path}", buf.getvalue(), {**H, "Content-Type": "image/jpeg", "x-upsert": "true"}, "POST")
        r = row(n, d["sort"], photo, f"{base}/storage/v1/object/public/menu/{path}", date.today().isoformat())
        req(f"{base}/rest/v1/dish_photos?on_conflict=kitchen_n,dish_n", json.dumps(r).encode(), {**H, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}, "POST")
        print(f"ok  {n}-{d['sort']:<2} {d['name']:<40} {credit(photo)} | {photo.get('alt','')[:60]}")
        if sheet:
            t = img.copy(); t.thumbnail((260, 200)); c = Image.new("RGB", (270, 230), "white"); c.paste(t, (5, 5))
            ImageDraw.Draw(c).text((5, 208), f"{n}-{d['sort']} {d['name'][:38]}", fill="black"); tiles.append(c)
    for n, m, name in missing:
        print(f"NO MATCH {n}-{m} {name}")
    if sheet and tiles:
        os.makedirs(sheet, exist_ok=True)
        for s in range(0, len(tiles), 12):
            page = Image.new("RGB", (270 * 4, 230 * 3), "white")
            for i, t in enumerate(tiles[s:s + 12]):
                page.paste(t, ((i % 4) * 270, (i // 4) * 230))
            page.save(f"{sheet}/sheet-{s // 12 + 1}.png")
    print(f"{len(tiles) if sheet else 'done'}; {len(missing)} dishes without a match")


if __name__ == "__main__":
    main()
