# Commit guidelines

Conventional Commits, in English. Short.

```text
type(scope): what changed
```

- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf`, `style`, `revert`.
- Scope is optional: `app`, `site`, `ops`, `ci`, `docs`.
- Subject: lower case, no full stop, 72 characters or fewer.
- Add a body only when the "why" is not obvious.
- Reference the issue in the PR body ("Closes #NN"), not in the subject.
- Checked by `scripts/guard.py` in the `commit-msg` hook and in CI.
- First time on a new machine: `pip install pre-commit && pre-commit install --hook-type pre-commit --hook-type commit-msg`.
