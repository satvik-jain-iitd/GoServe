#!/usr/bin/env python3
"""Story #1262: a release to main must not carry the sample QR. The rider's Collect payment screen shows app/public/qr-sample.svg
until the owner gives the real image; a customer who scans a sample and pays is real harm. Exit 1 while the sample is in use.
Run in CI on pull requests whose base is main. Swapping the image means removing qr-sample.svg and the reference in RiderScreen.tsx."""
import pathlib, sys

def sample_in_use(root: pathlib.Path) -> list[str]:
    hits = [str(p.relative_to(root)) for p in [root / "app/public/qr-sample.svg"] if p.exists()]
    for p in (root / "app/src").rglob("*.tsx"):
        if "qr-sample" in p.read_text(errors="ignore"):
            hits.append(str(p.relative_to(root)))
    return hits

if __name__ == "__main__":
    hits = sample_in_use(pathlib.Path(__file__).resolve().parent.parent)
    if hits:
        print("SAMPLE QR IS STILL IN USE, so this cannot go to prod:", ", ".join(hits))
        sys.exit(1)
    print("no sample QR")
