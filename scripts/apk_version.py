"""Story #251: turn a release tag into the APK version. `v1.2.3` -> name 1.2.3, code 1002003 (grows with the tag).
Usage: apk_version.py <tag> <twa-manifest.json>   (prints the name; writes the manifest)"""
import json, re, sys
from pathlib import Path


def parse(tag: str) -> tuple[str, int]:
    m = re.fullmatch(r"v?(\d{1,3})\.(\d{1,3})\.(\d{1,3})", tag.strip())
    if not m:
        raise ValueError(f"not a release tag like v1.2.3: {tag!r}")
    a, b, c = map(int, m.groups())
    return f"{a}.{b}.{c}", a * 1_000_000 + b * 1_000 + c


def patch(manifest: Path, tag: str) -> str:
    name, code = parse(tag)
    m = json.loads(manifest.read_text())
    m.update(appVersionName=name, appVersionCode=code, appVersion=name)
    manifest.write_text(json.dumps(m, indent=2) + "\n")
    return name


if __name__ == "__main__":
    print(patch(Path(sys.argv[2]), sys.argv[1]))
