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
| 2026-10-14 | Skills | The `skill` tool reads the skill list at session start, so a skill created mid-session is not found until the session restarts. | Follow the new skill's files by hand for the rest of the session; load it via the tool next session. |
| 2026-10-14 | Review | A teaching-first review is best kept as one chapter per PR plus running journals (concepts, mental model, questions), not a chat dump. | For every reviewed PR, write a chapter and update the journals in `docs/pr-reviews/`. |
| 2026-10-14 | GitHub API | The create-review response `.comments` came back empty, but the comments were created; a fresh `pulls/N/comments` call showed all 16 with ids. | Always re-fetch `pulls/N/comments` to collect comment ids after posting; do not trust the review-create response's `.comments`. |
| 2026-10-14 | Review | On PR #59, 5 of 16 reviewer questions led to real code (Stripe regex, one test per secret pattern, guard-on-itself test, doc/regex sync test, install docs) in commit 6c068b67. The dev agent also corrected a reviewer miscount (11 types, not 12). | Measure a review by how many questions change the code. Ask specific, answerable questions; expect and welcome corrections. |
| 2026-10-14 | Skills | The reviewer must not only ask questions, it must tell the coder what to do next. A separate short handoff is clearer than burying directions among teaching. | End every review run with a one-paragraph English handoff (state line + numbered directions). Keep teaching in Romanized Hindi and the handoff in English, and keep chat short with the full review in the notebook. |
| 2026-10-14 | Review | In a sync run the handoff is a plain PR issue comment, not a review — so it never reads as a verdict and never unblocks the merge button. | Post the Mode C handoff with the reviewer account as an issue comment; keep `COMMENT`-only reviews for the teaching questions. |
| 2026-10-14 | Review | A review loop must move work forward, not only ask questions. The skill had handoffs for its 3 modes but none for the approve/merge stage, so the loop stalled after the sync. | Make Mode C a sync + close-out: classify the PR as follow-up, open, or aligned; hand off to the right next actor (coder or owner); when aligned, auto-approve and name the next story to continue. |
| 2026-10-14 | Review | The close-out loop ran end to end on PR #59: sync, classify (aligned), auto-approve, owner merge (`fa9a345b`), mark MERGED. Handoff is only complete when the next actor is named AND the next item is known. | Always end a cycle by naming the next critical story (here #41, dev deploy) so development never stalls. |

## Process learnings

- Follow `docs/ISSUE_PROTOCOL.md` for every problem: evidence, then the owning
  story, then an issue, then a fix branch, then verify, then docs, then a PR.
- Always verify a fix with a fresh end-to-end run. Never close an issue on hope.
- One branch per story. Keep PRs small.
- Secrets live in `~/Desktop/Secrets/` only. Never in the repo.
- A status check must also compare docs with each other. Two docs for one build drifted apart (spec vs build design). The build design now owns the build; the spec points to it.
- A story needs its issue before any code. Check the issue list at the start of a phase, not at the first commit.
- Output tokens cost more than input. Keep reading and judging on the strong model; hand long prose to a small model that works only from a brief, then check its output against the brief.
- A quality pass on generated prose needs a mechanical scan too: one stray Devanagari character slipped past a careful read; `grep -P '[\x{0900}-\x{097F}]'` catches it in one line.
- The two-account rule covers the PR itself, not only the commits. PR #60 had dev-account commits but was opened by the review account. Open every PR from the dev account; the review account only reviews, approves and merges.
- CI only runs on PRs whose base is `main` or `dev`. A stacked PR on another feature branch shows no checks; retarget it to `dev` (close and reopen) to start CI.
- A guard that scans for secrets flags its own tests. Build test fixtures from string parts at runtime so the repo stays clean.
- `gh auth refresh` has no account flag. Switch account first (`cd ~ && command gh auth switch`), refresh, and switch back.
- Documentation is never on the critical path. Post the questions and the coder handoff as soon as the analysis is done; write the notebook afterwards in the background. PR #62 made the coder wait for the writer; the owner stopped it.
- A deploy workflow is only as real as the branch it runs on. PR #63 copied a working workflow, but `main` has no `app/` and the release checklist (PLAN.md section 2, rule 17) never ships it. Before trusting a trigger, check that its inputs can exist on that branch.
- When the coder's checkout is on another branch, the reviewer hands over a notebook bundle in the scratchpad instead of writing into the working tree; the coder copies it onto the right branch. Avoids rebase conflicts on shared docs.
- Found by test, 14 Oct 2026 (docs link still to add): Realtime checks row rules with the login token only, not custom headers. A header-based session rule would pass normal reads and silently send no live events. Test the live event, not just the read.
- `SUBSCRIBED` does not mean the server is listening yet. An insert right after it can be missed; wait about a second in tests.
- A green CI can prove nothing: PR #64's schema test is skipped in CI (no token). Say "local only" in the test list, and let the reviewer re-run it with the vault token before approving.
- Check the live system, not only the diff: one query showed RLS off and no FK indexes on goserve-dev. The diff cannot show what the database is.
- I wrote the workflow tests after the code, so they never showed red. A mutation check (break the code on purpose, see the test fail) is the fallback; do the test first next time.
- The layout library reads a third edge field as an "ai link". Passing the output index there hid a branch and put a link through a node. Pass only [from, to].
- Supabase RPC with the service role needs both headers, `apikey` and `Authorization: Bearer`. With `apikey` alone the call runs as anon and fails with "permission denied".
- n8n webhook header auth answers 403, not 401. To return 401 the token is checked in a Code node.
- Read the CI status before the PR body. PR #66 said "tests pass" and they did, but the Guard job was red on a 77-character commit subject; the PR was not mergeable. The first line of a review is the check list.
- A migration list in a follow-up (F63) must grow with every new migration. 0003 was applied to dev and missing from the prod list; prod would have had tables without the functions.
- Replacing a function in a new migration can break an old test that relied on the order of its steps (the row level security lock test hit a uuid cast). Re-run all earlier tests after every migration, and give test claims real uuids.
- A test glob must match every test file: `node --test <dir>` does not work on this Node, so name files `*.test.js` and pass a glob.
- When a model only advises, record why its advice was unusable with a status the labels can use later (guard failed, low confidence, cost cap, error). A plain "ok" next to a wrong pick poisons future training data.
- A tool's return id is not proof of the event. The reviewer told the owner PR #67 was approved while GitHub held a COMMENT review. After every post, read the state back (`gh api .../reviews`) and report what GitHub says.
- "Left clean" must name every store the test touches. PR #65 cleaned the tables but left 21 anonymous users in auth.users. Count side effects outside the tables too (auth, storage, logs).
- The notebook bundle is cumulative and copied by the coder; a chapter written after the copy rides with the next PR. Say which chapters a bundle holds in the handoff.
- A library can retry a failed call for seconds, which hides an offline fallback behind a spinner. Turn retries off and set a short timeout where a saved copy exists, and test the slow-failure case, not only the instant one.
- Test the screen with the network answered by the test (Playwright routes): fast, no keys, and it checks what the phone really sends. The real call is a separate live row.
- An anonymous session is per device and persists. A per-session cap (20) is also a per-device cap until site data is cleared. Say so where the cap is decided, and give the demo a reset path before the cap can bite.
- A test helper that pushes live events must keep them until the app has connected, and wait a moment after the join answer. A push into nothing made one test fail one run in three.
- Integration tests that place real orders leave rows that cannot be deleted by design, and anonymous sign-ins are limited to 30 an hour. Plan the cleanup and the run count before writing such a test.
- The permission guard refused a script that turned off a protection trigger to delete rows. Ask the owner first for anything that switches off a safety rule, even on dev.
- A handoff state line like "A44 yes" reads as "already agreed" to a reader without context. Write "haan ya na on A44" when the decision is still open. The writer flagged this on PR #70.
- Count the handoff words before posting, not after: the PR #70 review body went out at 150 words against the 120 cap.
- A long run of API calls in one script can fail halfway on a network error. Post replies in a loop with a retry, and read the output to retry only the failed ones.
- Compare moments with `Date.parse`, not text: the same instant can be written with Z or +00:00, and a string compare calls them different.
- A word count that is printed but not enforced changes nothing: the PR #71 handoff went out at 141 words after the count was printed. Make the post script refuse a body over the cap.
- Check CI before reading the diff. PR #71 had a red Guard from a 73-character commit subject; the code was green on every test. The must-fix was the name tag, not the code.
- Inside the GoServe folder the `gh()` shell wrapper replaces `GH_TOKEN` with the development account, even after `export GH_TOKEN=...`. The reviewer's first APPROVE on PR #71 failed with 422 "Can not approve your own pull request". Reviewer posts use `command gh` (bypasses the wrapper), then read the review state back.
- Review replies were never folded into chapters 10 and 11 after merge. A 25-line script (`fold_replies.py`) now pastes each thread's last reply and sets the status to answered; run it at every sync.
- A frozen table still needs one clean door for deletes. A setting that only the owning function sets for one transaction (`goserve.reset`) kept `order_events` frozen for everyone else, and it replaced the "switch the trigger off" script that the permission guard blocked.
- Realtime matches the server's list of listeners to the client's list by position. A test double for the socket must echo the client's join list back, or a second listener (delete events) breaks the channel.
- Delete events cannot be filtered by column and carry only the primary key. A screen must drop only the ids it holds, and the docs must say which ids leak.
- A session shared by link makes the link the key. Say so in the decision record, and keep the id random (uuid), not a short code.
- Supabase Realtime sends delete events to every subscriber, without a column filter and without the RLS check, and carries only the primary key. Source: https://supabase.com/docs/guides/realtime/postgres-changes (confirmed on goserve-dev by the integration test).
