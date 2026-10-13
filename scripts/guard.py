#!/usr/bin/env python3
"""Repo guard (PLAN.md 9.1, CLAUDE.md rule 13). Stdlib only.
  guard.py files <paths...>   secrets, files over 500KB, merge markers, unclosed code blocks
  guard.py msg <message>      Conventional Commits, short subject
  guard.py count <n>          PR size, max 50 files
Used by .pre-commit-config.yaml and by CI."""
import os, re, sys

MAX_BYTES = 500 * 1024
MAX_FILES = 50
SECRET = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----"
    r"|sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}"
    r"|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}"
    r"|AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]{20,}"
    r"|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"  # JWT, e.g. Supabase keys
)
MARKER = re.compile(r"^(<<<<<<< |>>>>>>> )", re.M)
FENCE = re.compile(r"^\s*(```|~~~)", re.M)
MESSAGE = re.compile(r"^(feat|fix|docs|chore|refactor|test|ci|build|perf|style|revert)(\([a-z0-9-]+\))?!?: \S.*$")


def check_files(paths):
    errors = []
    for p in paths:
        if not os.path.isfile(p):
            continue
        if os.path.getsize(p) > MAX_BYTES:
            errors.append(f"{p}: file over 500KB")
            continue
        try:
            text = open(p, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue  # binary
        if SECRET.search(text):
            errors.append(f"{p}: looks like a secret")
        if MARKER.search(text):
            errors.append(f"{p}: merge marker")
        if p.endswith(".md") and len(FENCE.findall(text)) % 2:
            errors.append(f"{p}: unclosed code block")
    return errors


def check_message(msg):
    subject = msg.strip().split("\n", 1)[0]
    if not MESSAGE.match(subject):
        return f"commit subject must look like 'type(scope): text': {subject!r}"
    if len(subject) > 72:
        return f"commit subject over 72 characters: {len(subject)}"
    return None


def check_count(n):
    return f"PR changes {n} files, max {MAX_FILES}" if n > MAX_FILES else None


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "files":
        errs = check_files(args)
    elif cmd == "msg":
        errs = [e for e in [check_message(args[0])] if e]
    elif cmd == "count":
        errs = [e for e in [check_count(int(args[0]))] if e]
    else:
        sys.exit(f"unknown command {cmd}")
    print("\n".join(errs))
    sys.exit(1 if errs else 0)
