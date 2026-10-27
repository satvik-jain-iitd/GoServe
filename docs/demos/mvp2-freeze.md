# Freeze and tag for the demo (story #326)

Waits for #325 (the owner sits and goes through the phone list). Nothing here is done yet.

## What the tag covers

- The tag `mvp2-demo` goes on `main`, on the commit that the prod app runs when the owner finishes #325. Today that is `69cbba0` or a later commit.
- `main` holds only run-critical code (CLAUDE.md rule 17): `site/`, `app/`, `scripts/`, `design/tokens.json`, `ops/`, `.github/`. The tag does not cover `staging` or `dev`.

## The command (reviewer or owner, not the coder)

```bash
git fetch origin
git tag -a mvp2-demo -m "MVP2 demo: the customer, kitchen, rider and ops apps as shown to investors" origin/main
git push origin mvp2-demo
```

Check the tag points at the commit the prod app was built from: the build id on the prod app (`VITE_BUILD`) must equal `git rev-parse mvp2-demo^{commit}`.

## What frozen forbids on `main` until the demo

- No merge to `main` without the owner's ask. A hotfix is a `release/<name>` PR with the owner's yes, and it names the bug it fixes.
- No change under `app/`, `site/` or `design/tokens.json` for new features. No new dependency.
- `deploy-app.yml` and the Pages variables stay as they are. `VITE_OFFERS`, `VITE_OTP_GATE`, `VITE_PUSH_NATIVE` and the payment test switches stay unset.
- No prod database change and no n8n release, except a hotfix with the owner's yes.
- `letsdwelo.in` is not touched (CLAUDE.md rule 18).
- Work goes on: `staging` (native apps and backend v2) and `documents`.

## Then

Mark `dev` as frozen in CLAUDE.md (the third micro-task of #326) in its own PR on the lane that owns that file.
