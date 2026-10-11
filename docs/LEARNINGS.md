# GoServe — Learnings and Mistakes

This is the one place for what we learned and what we got wrong. Read it
together with `docs/process-trace.md` at the start of every session.

Rule: when you learn something or make a mistake, add one row here. Keep it
short. Say what happened and what to do next time.

## Mistakes we made, and the rule for next time

| Date | Area | What happened | Rule for next time |
|---|---|---|---|
| 2026-10-11 | n8n forms | Lead alerts arrived blank. The webhook body sits under `json.body`, and the Mongo node replaces the item, so `json.name` was empty in the Telegram node. | Read fields from `json.body` once, in a Normalise step. In a node placed after a node that rewrites the item, read the upstream node: `$('Node name').item.json.field`. See `docs/integrations/n8n-goserve-forms.md`. |
| 2026-10-11 | n8n forms | `receivedAt` showed the server timezone, not IST. | Stamp times in IST: `$now.setZone('Asia/Kolkata').toISO()`. |
| 2026-10-11 | git / GitHub CLI | A PR body passed with `--body` on the command line was mangled, because `$(...)` and `$('...')` inside double quotes ran as shell commands. | Write the PR body to a file and use `gh pr create --body-file <file>`. |
| 2026-10-11 | git | A 37 MB deck and a 258 KB SOW were pushed into git history. | Keep client docs in `knowledge/client_docs/` (gitignored). Never commit large binaries. |
| 2026-10-11 | GitHub | A fix merged to `dev` said "Closes #6", but the issue stayed open. | Closing keywords only fire on the default branch (`main`). A merge to `dev` needs a manual close. |

## Tooling learnings

| Date | Tool | Learning |
|---|---|---|
| 2026-10-11 | Cloudflare | `wrangler` cannot manage Pages custom domains (only list, create, and delete the project). The API can, but it does not create the DNS records for you. A domain stuck in an `error` state is fixed by deleting and re-adding it. Python `urllib` is blocked by the WAF (error 1010); set a normal `User-Agent`. |
| 2026-10-11 | n8n | "Folders" are tags. The public API marks workflow `tags` read-only and the internal `/rest` endpoint returns 404, so attaching a tag is a manual UI step. The public API **can** create credentials (`POST /api/v1/credentials`). |
| 2026-10-11 | Telegram | `getUpdates` returns nothing until the bot receives a message and no webhook is set. A private chat id equals the user's numeric id. `sendMessage` only reaches a user who has started the bot. |
| 2026-10-11 | GitHub | A repo must be public for free branch protection and required checks. |
| 2026-10-11 | Astro | Pages build with a trailing-slash redirect (HTTP 308) by default. |
| 2026-10-11 | Playwright / axe | The accessibility scan flags colour contrast on elements hidden by a reveal animation. Force them visible (`opacity: 1`, `transition: none`) before the scan. |
| 2026-10-11 | Tooling | The agent cannot view images. For PDFs use `pdftoppm` and `pdfplumber`, not `pymupdf`. |

## Process learnings

- Follow `docs/ISSUE_PROTOCOL.md` for every problem: evidence, then the owning
  story, then an issue, then a fix branch, then verify, then docs, then a PR.
- Always verify a fix with a fresh end-to-end run. Never close an issue on hope.
- One branch per story. Keep PRs small.
- Secrets live in `~/Desktop/Secrets/` only. Never in the repo.
