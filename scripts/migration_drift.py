#!/usr/bin/env python3
"""Story #928: names every merged migration whose proof object is missing on the dev project (read-only; nothing is written).
Reuses prod_backend_v2's markers: the first object a file creates proves the file ran. A file with no marker (a drop-only file) cannot be proved and is skipped.
Limit: a later file that redefines an earlier function has the same marker, so it reads as applied (see prod_backend_v2.py).
Usage: migration_drift.py [--env dev]   exit 0 = no drift, 1 = drift (files named), 2 = could not check. Needs SUPABASE_ACCESS_TOKEN."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prod_backend_v2 as p
import release_db


# Files whose marker function was later given another argument list (sim_clear_all/0 became sim_clear_all/1 in the slices of #874), so the marker can never be found again.
REPLACED_LATER = {"20261104120000_sim_groups.sql"}


def missing(present, v1, v2):
    """File names (V1 then V2) whose marker is not in `present`."""
    return [f for f, m in v1 + v2 if m and m not in present and f not in p.SUPERSEDED and f not in REPLACED_LATER]


def report(files):
    if not files:
        return 0, "No drift: every migration file on dev has its proof object on the dev project."
    return 1, "DRIFT: merged but not applied on the dev project:\n" + "\n".join("  " + f for f in files)


if __name__ == "__main__":
    try:
        code, text = report(missing(p.present(release_db.DEV_REF), p.load("app/supabase/migrations"), p.load("supabase/migrations")))
    except Exception as e:   # no token, no network: say so, never pass silently
        print(f"Could not check: {e}")
        sys.exit(2)
    print(text)
    sys.exit(code)
