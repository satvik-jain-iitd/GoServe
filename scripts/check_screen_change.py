#!/usr/bin/env python3
"""Story 822: a pull request that touches app/src cannot merge until it names the board the screen was checked against, points at the render,
and (when an accepted screen picture changed) says which board the new look matches and which story asked for it. Stdlib only.
  check_screen_change.py --body-file <f> --base <ref> [--repo <path>] [--head <branch>]   CI: the pull request description
  check_screen_change.py --local [--base <ref>]                                            the Mac, before a push: reads the commit messages since the base
The failure prints the exact lines to add. It never points at a rule file."""
import argparse, os, re, subprocess, sys

SCREEN_PATHS = ("app/src/",)                       # a change here can move a screen
BASELINE = "app/tests/e2e/screens-baseline/"        # the accepted pictures (story 821)
PLACEHOLDER = re.compile(r"^<.*>$")


def run(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, check=True).stdout


def field(body, name):
    """The first `Name: value` line, or '' when it is missing or still a <placeholder>."""
    m = re.search(rf"^{re.escape(name)}:[ \t]*(.*?)[ \t]*$", body, re.M | re.I)
    v = m.group(1) if m else ""
    return "" if PLACEHOLDER.match(v) else v


def rows(body):
    """`Screen changed: <picture> | <board> | <story>` rows, as {picture: (board, story)}. A half-filled row has an empty part."""
    out = {}
    for m in re.finditer(r"^Screen changed:[ \t]*(.*)$", body, re.M | re.I):
        parts = [p.strip() for p in m.group(1).split("|")]
        pic = os.path.basename(parts[0]) if parts and parts[0] else ""
        if not pic:
            continue
        clean = [("" if PLACEHOLDER.match(p) else p) for p in (parts + ["", ""])[1:3]]
        out[pic] = (clean[0], clean[1])
    return out


def check(body, changed, base_name="dev", head_name=""):
    """Returns (ok, lines to print)."""
    if base_name == "main" or head_name == "main":
        return True, ["base or head is main (a dev -> main promotion or a main -> dev back-merge): screen check skipped"]
    touched = [p for p in changed if p.startswith(SCREEN_PATHS)]
    if not touched:
        return True, ["no app/src path touched: screen check skipped"]
    pictures = sorted(os.path.basename(p) for p in changed if p.startswith(BASELINE))
    todo = []
    if not field(body, "Design board"):
        todo.append("Design board: <the name of the board on the canvas this screen was checked against>")
    if not field(body, "Approved"):
        todo.append("Approved: <the date the owner approved that board, for example 31 Oct 2026>")
    render = field(body, "Render")
    if not render.startswith("http"):
        todo.append("Render: <link to the CI run of this pull request: its Checks tab, App job, artifact 'screens'>")
    have = rows(body)
    for pic in pictures:
        board, story = have.get(pic, ("", ""))
        if not board or not story:
            todo.append(f"Screen changed: {pic} | <the board this new look matches> | <#story that asked for the change>")
    if not todo:
        return True, [f"screen check ok: board {field(body, 'Design board')} (approved {field(body, 'Approved')}), {len(pictures)} picture(s) changed and named"]
    lines = [f"SCREEN CHECK FAILED. This pull request changes app/src ({len(touched)} file(s), for example {touched[0]}),",
             "so its description must carry these lines. Add them to the pull request description (not a comment), then re-run the Guard job:", ""]
    lines += [f"  {t}" for t in todo]
    if pictures:
        lines += ["", f"Changed pictures: {', '.join(pictures)}. A picture may only change when a board shows the new look; if none does, the app is the drift: undo the change."]
    return False, lines


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-file")
    ap.add_argument("--base", default="origin/dev")
    ap.add_argument("--repo", default=".")
    ap.add_argument("--head", default="")
    ap.add_argument("--local", action="store_true")
    a = ap.parse_args(argv)
    head = a.head or run(a.repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
    if a.local:
        base = a.base if a.base.startswith("origin/") else f"origin/{a.base}"
        try:
            run(a.repo, "rev-parse", "--verify", "-q", base)
        except subprocess.CalledProcessError:
            print(f"skip screen check: no {base} here"); return 0
        body = run(a.repo, "log", f"{base}..HEAD", "--format=%B")
    else:
        if not a.body_file:
            ap.error("--body-file is needed (or --local)")
        body = open(a.body_file, encoding="utf-8").read()
        base = a.base
    mb = run(a.repo, "merge-base", base, "HEAD").strip()
    changed = [l for l in run(a.repo, "diff", "--name-only", mb, "HEAD").splitlines() if l]
    ok, lines = check(body, changed, base.rsplit("/", 1)[-1], head)
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
