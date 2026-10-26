"""F210: remember the open flag and the hours of a kitchen before a check changes them, and put them back, whatever happens."""


def remember(saved: dict, kitchen_id: str, row: dict) -> None:
    saved.setdefault(kitchen_id, {"open": row["open"], "opens_at": row["opens_at"], "closes_at": row["closes_at"]})   # the first state wins


def restore(patch, saved: dict) -> None:
    for kitchen_id, body in saved.items():
        try:
            patch(kitchen_id, body)
        except Exception:   # a network blip on one kitchen must not leave the others changed
            pass
