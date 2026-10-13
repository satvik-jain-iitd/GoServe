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
| 2026-10-13 | Planning | The first plan was docs only, while the demo was 5 days away, and the demo depended on a server that sometimes goes down. | Run an independent review before a big plan. Keep any single server out of the demo path. Give the demo a local backup. |
| 2026-10-13 | Diagrams | The first diagrams passed the crossing count but arrows still ran across box titles and along box edges. | Measure every tidiness rule, not only crossings. Put box titles in header boxes. Look at every picture after the gate passes. |
| 2026-10-13 | Diagrams | An index-based arrow style (`linkStyle`) pointed at the wrong arrow after the order was shuffled. | Do not style arrows by index. Use the arrow type (dotted `-.->`) instead. |
| 2026-10-13 | Facts | The docs said the pilot starts in Kota. The founder lives in Kota, but the pilot starts in Delhi. | Ask where the business starts, not where the founder lives. |
| 2026-10-13 | Docs | I expanded the components file but left its "Prompt for Claude" in place, so it looked unfinished. | When a doc's instruction block is done, replace it with a "done + how to keep current" note in the same change. |
| 2026-10-13 | n8n rules | I read "fix the workflow count up front" as a hard cap. The owner meant: no throwaway or duplicate workflows. | The rulebook now says "a registry, not a cap". New use case = new workflow, registered. |
| 2026-10-13 | Hosting | I assumed `goserve.pages.dev` was free for the app. It already serves the investor site (same project as letsdwelo.in). | Every Pages project has its own .pages.dev name. Check the address with curl before planning it. |
| 2026-10-13 | Hosting | I then told the owner `goserve.pages.dev` was our site because it returned a page titled GoServe. The deploy log showed our project is `goserve-arw.pages.dev`; the other site is someone else's. | Never infer ownership from a page title. Read the address from our own deploy log or the Cloudflare API. |

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
| 2026-10-13 | Supabase | Free plan: 2 projects per owner across orgs, 200 live connections, 2M live messages a month, 500 MB, paused after 1 week idle, no backups. |
| 2026-10-13 | Vercel | Hobby is non-commercial only. A startup demo counts as commercial. |
| 2026-10-13 | Vercel | A repo only shows in a Vercel account if the Vercel GitHub app on the repo owner's GitHub is tied to that Vercel account; one GitHub account's app was already tied to another Vercel team. Hobby can block deploys when the commit author is not the Vercel owner. Deploying from GitHub Actions with a token avoids both. |
| 2026-10-13 | Cloudflare | `wrangler pages project create` now delegates to Workers and fails on an empty folder. `--force` creates a classic Pages project (only needed once). Read the real address from the create output. |
| 2026-10-13 | Mermaid | With the ELK layout, box titles get crossed by arrows. Use a header box inside each group, linked with `~~~`. Edges are named `L_<from>_<to>_<n>`, so node ids must not contain `_`. |

## Process learnings

- Follow `docs/ISSUE_PROTOCOL.md` for every problem: evidence, then the owning
  story, then an issue, then a fix branch, then verify, then docs, then a PR.
- Always verify a fix with a fresh end-to-end run. Never close an issue on hope.
- One branch per story. Keep PRs small.
- Secrets live in `~/Desktop/Secrets/` only. Never in the repo.
- A status check must also compare docs with each other. Two docs for one build drifted apart (spec vs build design). The build design now owns the build; the spec points to it.
- A story needs its issue before any code. Check the issue list at the start of a phase, not at the first commit.
