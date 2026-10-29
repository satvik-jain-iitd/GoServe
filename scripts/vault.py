"""The GoServe vault reader (owner, 29 Oct 2026). Every GoServe key lives in ~/Desktop/Secrets/goserve/goserve.env; the older shared files
(02_databases.env, 04_integrations.env, ...) no longer hold GoServe keys (the owner removed the copies on 29 Oct 2026; the backup is goserve/backup-2026-10-29/).
They keep the account-level keys (SUPABASE_ACCESS_TOKEN, UPTIMEROBOT_API_KEY). Look in goserve.env first, then in the old file, so a key of either kind is found.
Nothing here prints a value."""
import os, re


def _root():
    return os.path.join(os.path.expanduser("~"), "Desktop", "Secrets")


def read(old_file):
    """The text of goserve.env followed by the old file, so a regex over the text finds the goserve value first."""
    text = ""
    for p in (os.path.join(_root(), "goserve", "goserve.env"), os.path.join(_root(), old_file)):
        try:
            with open(p, encoding="utf-8") as f:
                text += f.read().rstrip("\n") + "\n"
        except OSError:
            pass
    return text


def get(key, old_file):
    m = re.search(r"^" + re.escape(key) + r"=(\S+)", read(old_file), re.M)
    return m.group(1) if m else None
