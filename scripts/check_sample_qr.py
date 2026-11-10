#!/usr/bin/env python3
"""Stories #1262 and #1263: a release to main must not be able to show the sample QR. The rider's Collect payment screen shows app/public/qr-sample.svg only
when the build sets VITE_SAMPLE_QR=1 (the e2e config does; dev and prod builds do not). A customer who scans a sample and pays is real harm.
Exit 1 when the prod deploy workflow sets the flag. Run in CI on pull requests whose base is main."""
import pathlib, sys

def sample_in_prod(root: pathlib.Path) -> list[str]:
    prod = root / ".github/workflows/deploy-app.yml"
    return [str(prod.relative_to(root))] if prod.exists() and "VITE_SAMPLE_QR" in prod.read_text(errors="ignore") else []

if __name__ == "__main__":
    hits = sample_in_prod(pathlib.Path(__file__).resolve().parent.parent)
    if hits:
        print("THE PROD BUILD ALLOWS THE SAMPLE QR, so this cannot go to prod:", ", ".join(hits))
        sys.exit(1)
    print("prod build cannot show the sample QR")
