#!/usr/bin/env python3
"""OWNER-RUN (story #677). Puts backend v2 on the PROD project: the missing v2 migrations, all functions, the function secrets, the push vault pair, then checks.
Dry run by default: it only reads and prints the plan (names only, never a secret value). --apply writes. Stops at the first error.
It refuses goserve-dev and any project not named GoServe. The Management API is used for everything (no supabase CLI).
The prod address comes from SUPABASE_GOSERVE_PROD_URL (vault 02_databases.env), the token from SUPABASE_ACCESS_TOKEN.
Fresh secrets are written to the vault file 05_goserve_prod_functions.env first, then sent. Usage: prod_backend_v2.py [--apply]"""
import glob, json, os, re, secrets, sys, time, tomllib, urllib.error, urllib.request, uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import release_db   # one place for the API call, the project name and the dev ref

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
FUNCS = os.path.join(ROOT, "supabase", "functions")
VAULT = os.path.expanduser("~/Desktop/Secrets/05_goserve_prod_functions.env")
FIXED_CODE = "123456"   # public by design for the test phase (#665)
FRESH = ("PAYMENTS_WEBHOOK_SECRET", "PUSH_NOTIFY_SECRET")   # never the dev value: generated here
SUPERSEDED = {"0023_one_kitchen_per_staff.sql"}   # its index is dropped by the v2 staff_many_kitchens migration, so a good prod does not have it
# PUSH_PROVIDER and PAYMENTS_PROVIDER stay unset on prod: unset means the fake adapters, as the code defaults (push.ts, gateway.ts)


class Refused(Exception):
    pass


def _args(s):
    """Number of parameters in a function's argument text (pg_proc.pronargs counts defaults too)."""
    if not s.strip():
        return 0
    depth, n = 0, 1
    for c in s:
        depth += c in "(["
        depth -= c in ")]"
        n += c == "," and depth == 0
    return n


MARKERS = [   # (kind, regex): the first create or alter in a file names one object that proves the file ran
    ("table", r"create\s+(?:table|view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)"),
    ("function", r"create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(((?:[^()]|\([^()]*\))*)\)"),
    ("index", r"create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(\w+)"),
    ("policy", r"create\s+policy\s+(\w+)"),
    ("column", r"alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)"),
]


def marker(sql):
    """'table:x', 'function:name/nargs', 'index:x', 'policy:x' or 'column:t.c' for the first object a file makes, or None."""
    s = re.sub(r"--[^\n]*", "", sql)
    best = None
    for kind, rx in MARKERS:
        m = re.search(rx, s, re.I)
        if m and (best is None or m.start() < best[0].start()):
            best = (m, kind)
    if best is None:
        return None
    m, kind = best
    if kind == "function":
        return f"function:{m.group(1)}/{_args(m.group(2))}"
    if kind == "column":
        return f"column:{m.group(1)}.{m.group(2)}"
    return f"{kind}:{m.group(1)}"


def load(folder):
    return [(os.path.basename(f), marker(open(f).read())) for f in sorted(glob.glob(os.path.join(ROOT, folder, "*.sql")))]


def build_plan(ref, name, v1, v2, present):
    """What is missing, from files [(name, marker)] and the set of markers found on prod. Refuses dev and any project not called GoServe."""
    if ref == release_db.DEV_REF:
        raise Refused("this is goserve-dev. This script is for the production project only.")
    if "goserve" not in name.lower() or "dev" in name.lower():
        raise Refused(f"the project name is {name!r}; the prod project is called GoServe. Check SUPABASE_GOSERVE_PROD_URL.")
    return {"v1_gaps": [f for f, m in v1 if m and m not in present and f not in SUPERSEDED],
            "v2_missing": [f for f, m in v2 if m is None or m not in present]}


PRESENT_SQL = ("select 'table:' || table_name as m from information_schema.tables where table_schema = 'public' "
               "union all select 'column:' || table_name || '.' || column_name from information_schema.columns where table_schema = 'public' "
               "union all select 'function:' || p.proname || '/' || p.pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' "
               "union all select 'index:' || indexname from pg_indexes where schemaname = 'public' "
               "union all select 'policy:' || policyname from pg_policies")


def present(ref):
    return {r["m"] for r in release_db.sql(ref, PRESENT_SQL)}


def function_names():
    return sorted(d for d in os.listdir(FUNCS) if os.path.isdir(os.path.join(FUNCS, d)) and not d.startswith("_"))


def verify_jwt(name):
    cfg = tomllib.load(open(os.path.join(ROOT, "supabase", "config.toml"), "rb"))
    return cfg.get("functions", {}).get(name, {}).get("verify_jwt", True)


def function_files(name):
    """Every .ts file under supabase/functions, no tests, as paths relative to it: a function may import a sibling (orders and coupons use quote/); the bundler takes what the entrypoint imports."""
    return [os.path.relpath(p, FUNCS) for p in sorted(glob.glob(os.path.join(FUNCS, "**", "*.ts"), recursive=True)) if not p.endswith(".test.ts")]


def multipart(meta, files):
    b = uuid.uuid4().hex
    parts = [f'--{b}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{json.dumps(meta)}\r\n'.encode()]
    for rel in files:
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{rel}"\r\nContent-Type: application/typescript\r\n\r\n'.encode()
                     + open(os.path.join(FUNCS, rel), "rb").read() + b"\r\n")
    return b"".join(parts) + f"--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"


def deploy(ref, name):
    body, ctype = multipart({"name": name, "entrypoint_path": f"{name}/index.ts", "verify_jwt": verify_jwt(name)}, function_files(name))
    req = urllib.request.Request(f"{release_db.API}/{ref}/functions/deploy?slug={name}", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": ctype, "User-Agent": "goserve-release"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"deploy {name}: {e.code} {e.read().decode()[:300]}")


def read_vault():
    out = {}
    if os.path.exists(VAULT):
        for line in open(VAULT):
            k, _, v = line.strip().partition("=")
            if k and not k.startswith("#"):
                out[k] = v
    return out


def ensure_fresh(vault):
    """Generate the missing fresh secrets and write them to the vault file BEFORE anything is sent. Returns the names it made."""
    made = [k for k in FRESH if not vault.get(k)]
    if made:
        fd = os.open(VAULT, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
        with os.fdopen(fd, "a") as f:
            f.write(f"# {time.strftime('%Y-%m-%d %H:%M')} goserve prod functions (story #677)\n")
            for k in made:
                vault[k] = secrets.token_hex(32)
                f.write(f"{k}={vault[k]}\n")
        os.chmod(VAULT, 0o600)
    return made


def get(url, key, path="", body=None):
    req = urllib.request.Request(url + path, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "goserve-release"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except ValueError:
            return e.code, None


def checks(url, anon):
    s, h = get(url, anon, "/functions/v1/health")
    ok = s == 200 and (h or {}).get("ok") is True
    print("health:", "ok" if ok else f"FAILED {s} {h}")
    s, o = get(url, anon, "/functions/v1/otp/send", {"phone": "9999999999"})   # the anon key is no user: the contract answer is 401 unauthorized, no SMS, no row
    ok2 = s == 401 and (o or {}).get("ok") is False and (o or {}).get("error") == "unauthorized"
    print("otp/send contract (401 unauthorized, ok false):", "ok" if ok2 else f"FAILED {s} {o}")
    return ok and ok2


def main(argv, env=os.environ):
    url = env["SUPABASE_GOSERVE_PROD_URL"]
    ref = release_db.ref_from_url(url)
    try:
        name = release_db.project_name(ref) if ref != release_db.DEV_REF else ""
        v1, v2 = load("app/supabase/migrations"), load("supabase/migrations")
        plan = build_plan(ref, name, v1, v2, present(ref))
    except Refused as e:
        sys.exit(f"Refused: {e}")
    funcs = function_names()
    have_funcs = sorted(f["slug"] for f in release_db._call("GET", ref, "/functions"))
    have_secrets = sorted(s["name"] for s in release_db._call("GET", ref, "/secrets"))
    want = ["OTP_FIXED_CODE", *FRESH]
    vault = read_vault()
    print(f"Prod project {name!r} ({ref}).")
    print(f"v1 migrations: {len(v1)} files, gaps: {plan['v1_gaps'] or 'none'}")
    print(f"v2 migrations: {len(v2)} files, missing (in this order): {plan['v2_missing'] or 'none'}")
    print(f"functions: deployed {have_funcs or 'none'}; will deploy all {len(funcs)}: {funcs}")
    print(f"secrets set now: {have_secrets or 'none'}; will set: {want}; fresh ones not yet in the vault file: {[k for k in FRESH if not vault.get(k)] or 'none'}")
    print("push vault pair (push_notify_url, push_notify_secret): will be written. Anonymous sign-in is", "ON" if release_db.get_auth(ref).get("external_anonymous_users_enabled") else "OFF (will be switched on)")
    if "--apply" not in argv:
        print("Dry run. Nothing written. Add --apply (after the owner's yes) to run the plan.")
        return
    if plan["v1_gaps"]:
        sys.exit(f"Refused: prod is missing v1 migrations {plan['v1_gaps']}. Stop and ask the owner.")
    sql_dir = {f: os.path.join(ROOT, "supabase", "migrations", f) for f, _ in v2}
    for f in plan["v2_missing"]:
        try:
            release_db.sql(ref, open(sql_dir[f]).read())
        except Exception as e:
            sys.exit(f"STOPPED at migration {f}: {e}")
        print("applied", f)
    for n in funcs:
        try:
            deploy(ref, n)
        except Exception as e:
            sys.exit(f"STOPPED: {e}")
        print("deployed", n)
    ensure_fresh(vault)
    release_db._call("POST", ref, "/secrets", [{"name": "OTP_FIXED_CODE", "value": FIXED_CODE}, *({"name": k, "value": vault[k]} for k in FRESH)])
    print("secrets set:", want)
    release_db.sql(ref, "delete from vault.secrets where name in ('push_notify_url', 'push_notify_secret')")
    release_db.sql(ref, f"select vault.create_secret('{url}/functions/v1/push/notify', 'push_notify_url'), vault.create_secret('{vault['PUSH_NOTIFY_SECRET']}', 'push_notify_secret')")
    print("push vault pair written")
    if not release_db.get_auth(ref).get("external_anonymous_users_enabled"):
        release_db.set_auth(ref)
        print("anonymous sign-in switched on")
    if not checks(url, env["SUPABASE_GOSERVE_PROD_ANON_KEY"]):
        sys.exit("Checks failed. Look at the prod project before going on.")
    print("done")


if __name__ == "__main__":
    main(sys.argv[1:])
