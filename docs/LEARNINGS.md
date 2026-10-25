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
- A fake live socket test must wait until the screen has really seen the row before it pushes the delete. Two events in one tick are batched into one render, so the "seen, then gone" rule never fires. Wait for a visible sign (the current step text) between them.
- "Merged" in a handoff is a claim. PR #72 was still open when the handoff said it was merged; `git fetch` and `gh pr view` showed OPEN, and a branch cut from `dev` then lacked the code. Check the state before cutting the next branch.
- A review comment must sit on a line inside a diff hunk. The reviewer anchored on `toBeLessThan(2000)` at line 90, which was an older test, and GitHub refused the whole review ("Line could not be resolved"). Check every anchor against the hunk ranges of the PR diff before posting (a 15-line script does it); the new test was at line 120.
- The reviews API wants the full 40-character commit id; a short SHA fails with "Variable $commitOID ... invalid value".
- A screen that asks a server once and never retries must also show the failed state on the item itself; an alert at the top plus "Asking…" on the slip reads as "still working". Check the refused path in every one-shot call.
- `count: "exact"` with a `limit` gives the right total but the rows are only the first page; a "latest row of kind X" lookup needs its own filtered query, not a scan of the page.
- Two lists of the same names (the Jev status in `decide_result.js` and the reasons in `ops.ts`) drift apart. Keep both in the test files so a new status fails a test, and a reason text of "no reason given" is the safe fallback.
- A static host does not open `/health` on a fresh visit unless unknown paths fall back to `index.html`. The service worker only helps after the first load. Test the fallback in the deploy config, not only in the app.
- A fake that ignores a query's `limit` hides the bug the limit causes. Make the test double cut rows the way the real server does, then the test fails when the code relies on an unbounded list.
- A made-up sample id must still be valid hex. `d3m0d3m0-...` looked clever, the screen showed it as the order number and the test pattern for order numbers did not match it. Sample data goes through the same shape checks as real data.
- When a loop reschedules itself, a state switch inside it (online to offline) must not end the loop. The fallback ran, the banner showed, and the story stood still on Placed until the loop was told to go on.
- "Answered" is not "resolved": 207 answered threads on 12 merged PRs sat unresolved on GitHub until the owner noticed. At every sync the reviewer resolves each answered thread (GraphQL `resolveReviewThread` as the review account) and reads the count back; the notebook status and the GitHub state must match.
- The handoff cap now stops a post: the PR #74 body came out at 126 words, the script refused it, and a 115-word body went out. Keep the check before the post, never after.
- A health check that makes a real call (token, kill switch, route, model) proves more than a ping, but it costs a run per view; say the cost and the session it lands in before opening the page to everyone.
- A retry loop must name the errors it retries on. The autopilot retries on everything except a network failure, so a server "no" (503, 404) is retried every 2 seconds; the test suite covered the network case only. Ask of every loop: which answers stop it?
- The comment generator caps questions at 7 per file and exits non-zero; with `2>/dev/null` the empty output looked like success until the post failed. Never silence a generator's stderr in a pipeline; check its exit code.
- The autopilot's next-step table (`autopilot.ts`) and the rider tab's buttons (`riderActions`) tell the same story in two places. A change to the order steps must change both; the unit test of the table walks the whole story so a missed change shows.
- A loop that handles one error (network) must say what it does with every other error. Stopping on a refusal is the safe default; retrying one forever is not.
- An average that includes health checks and a total cost that leaves them out tell two stories. Decide first what a "run" is, count the rest apart, and say so in the message.
- A `$json` inside a second read node is the first read's answer, not the workflow input. Name the input node (`$('Start')`) in every read of a SUB.
- The Autopilot reason for a refused step must be shown where the founder is looking, not only on the kitchen, rider and ops screens. The customer tab showed nothing; the assert that the text is visible caught it.
- A daily report sent at a fixed hour needs a window that ends at that hour and starts where the last one ended. A window of "today since midnight" sent at 21:00 drops the rows from 21:00 to midnight every day. Check the two edges of every time window before approving (PR #76, score_window.js). | reviewer, 14 Oct 2026
- When a review helper takes a threads file, say which shape it wants. `fold_replies.py` expects the REST comments list (`in_reply_to_id`, `user.login`); fed the GraphQL threads list it printed "folded 0" and changed nothing. A zero count from a helper is a finding, not a result (PR #75 sync). | reviewer, 14 Oct 2026
- Name the next story only after checking the merged PR list, not the open-issues list. Story issues stay open until the work reaches main, so an open issue says nothing. The reviewer named #42 as next; it was merged in PR #63 a day earlier (PR #76 handoff). | reviewer, 14 Oct 2026
- A read-only script that compares the live copy with the build (`verify_live.js`) is the cheapest way to "look at the canvas" without a login to the editor. It checks active flag, positions, links and layout in one run.
- A deploy that passes CI can still ship a broken app. The prod workflow built the app with no `VITE_*` keys, so the first prod page would have said "missing Supabase keys". When a second environment is added, read its build step line by line for every setting the first one needed.
- Dry run first, on the real target, read only: it showed in one call that prod is empty and anonymous sign-in is off. That is the proof the script's plan matches the real state.
- A live-versus-build check must build with the same deploy-time values as the deploy (token, address, credential ids), or every Code and URL parameter shows as different. Done in memory only, never printed.
- A contract written from memory is a hypothesis. The Jev contract said "chat completions" and 63 tests passed against a fake of that shape; the first real call got a 400. Take the fixture from a real answer before the tests are written, and run one real call before the workflow is built around it.
- The fallback worked exactly as designed: the rule decided, the row said `jev_error`. Because the failure was logged with a reason, the live run found the cause in one read of the execution.
- n8n will not publish a workflow whose sub-workflows are not published. A review reply that said otherwise was repeated without being tried. Try the activation on a copy of the facts (one API call) before writing a rule down.
- Playwright's `getByRole("heading", { name: "Kitchen" })` matches by substring, so a new h1 "GoServe Kitchen" made the old test ambiguous. Use `exact: true` for headings whose name is part of another.
- Several installed web apps on one origin share storage on Android Chrome but not on an iPhone. Write that down in the decision record before promising "one device works".
- Two environments must share nothing by accident: one table (address, credential, token, name mark) in the deploy script, and a test that the prod build holds no dev address. The alert workflow is the one thing shared on purpose.
- Look before asking the owner to click. The Pages project had existed since 12 Oct; the 522 only meant 'nothing deployed'. A read-only `cf pages list` settled it in one call after a one-time login.
- `git add -A` after a tool made a cache folder in the working tree committed it. A guard that blocks by path (not only by content) and a `.gitignore` line close the gap. Check `git status` before `add -A` after any CLI login.
- A live spec that reuses the selectors of a one-off script (the 15 Oct browser check) passed 20 of 20 first time, so keep one-off checks as a real spec file instead of a scratch script. It writes to dev, so it is run by hand, not in CI.
- A limit that sits 150 ms from the normal time is a coin flip. We moved Jev from 900 to 1500 ms (owner, 15 Oct) after 6 of 21 decide steps ran over 900 ms. Keep a gap of at least half the normal time.
- Total running cost of MVP 0 is about zero: every tier is free, the Oracle server is on the free tier (owner, 15 Oct), and Jev costs about $0.00002 a decision with a $2 cap.
- A new action in the order webhook changes the Route node: the fallback output moves one place. Four older tests held the old index. When a Switch gets a new output, grep every test that reads `Route` outputs.
- A new action needs three edits, not two: the Route switch, the Call node and the allow-list in Check token. The unit tests covered the first two; only the first live call showed the third (400 bad_action). Add the action to the Check token test whenever a route is added.
- A Postgres function called twice in one SELECT does not show its first change to a sub-select in the same statement. Test a repeat call in two statements.
- A rule that depends on "the same status again" belongs in the function, not the row trigger: the trigger also runs when another column changes.
- Chrome reads the manifest from the first HTML it gets. A manifest link changed later by JavaScript is too late for Add to Home Screen. Write one static page per role at build time and test the raw HTML, also with the service worker ready.
- Icons for several apps in one product need one grid, one stroke weight and one corner radius. Only the glyph and one ring colour change. Look at all of them together on a contact sheet before you commit.
- A read of a fresh deploy can show the old page for a minute (edge cache). Read again with a new query string before you call a deploy broken.
- A notebook started with `kaggle kernels push` does not get the Kaggle Secrets you attached on the web page. The run fails at the first `get_secret`. Start runs that need a secret from the web page, or log the need before you spend GPU hours.
- A class-balance test on generated data caught two thin classes before any GPU time was spent. Put the balance check in the test, not in the training log.
- Splitting seeds by list position (last two to test) hid whole classes from train because related seeds sat together. Split by `index % 5`.
- Two Claude sessions in one checkout switch each other's branch and hide each other's files. Each session works in its own worktree: `git worktree add .worktrees/<issue>-<slug> <branch>` (the folder is in `.git/info/exclude`). One branch per issue number, temp files in the session's own scratchpad, never in `/tmp`.
- Fix the pass rule in the docs before the model result exists, and say how the numbers are averaged. E2 failed its own rule, and because the rule was written first nobody could bend it.
- Laya fits its confidence temperature on a slice of the training items. If the test set uses unseen phrasings, the model is over-confident (97.9% in-sample, 72% on test). Check calibration on a split that has unseen seeds.
- Run Kaggle jobs that need no GPU with `enable_gpu: false`. Dry-run and eval used no GPU quota at all.
- State kept only in React is lost on refresh. Keep what the screen needs in the database or storage, and test a reload. When a new start-up rule is added, old tests that preload data may now land on another screen: run the whole suite, not one file.
- A merge conflict on the follow-ups and trace tables can drop rows without any error. After a merge, check that your own rows are still on dev.
- Two parts of a screen that ask for a session at the same moment each make an anonymous user. Share one in-flight request. An old e2e test that counts sign-ups caught it.
- A 200 from a settings PATCH is not proof. Read the setting back, and read it again after a minute if the first read looks old. Do not write "verified" before the read.
- Three open PRs at once (#124, #125, #128) made the owner merge in a set order and made me rebase twice. Rule 19: one open PR at a time; a reviewer's change is a commit on the same PR.
- `rl_agent_config.json` field `training.hours` is the history of the base checkpoint, not our run. I reported 1.96 h of GPU for a run that took about 12 minutes. Take run time from the kernel log timestamps and from `kaggle quota`, never from a config. A 3-epoch run on 5,400 items takes about 12 minutes on one T4, so retries are cheap.
- GPU rules (owner, 22 Oct 2026, after about 3.4 h of weekly Kaggle GPU went to an idle UI session while our real GPU work was about 20 min). Agent rules, every session:
  1. GPU only through `ops/ai/laya/kaggle/push.sh KERNEL_DIR SECONDS MAX_USED_HOURS`. It reads `kaggle quota`, refuses a push that would pass the cap, and sets a hard time limit. Never push a GPU kernel any other way.
  2. Never ask the owner to open or run a GPU notebook on the Kaggle page. Script kernels from the CLI stop by themselves.
  3. Anything that needs no GPU (dry-run, data, eval, scoring) runs with `enable_gpu: false`.
  4. Before every GPU run write the cap and the expected minutes in the experiment row. After it, run `kaggle quota` and write used before and after in the trace. If the two disagree with the log time, say so.
  5. At the end of every unit of work run `kaggle kernels list --mine` and `kaggle kernels status` on each kernel; nothing may still be RUNNING. Cancel strays.
  6. Run time comes from log timestamps and `kaggle quota`, never from a config field.
  7. First run of any new script: smallest size (1 epoch or a data slice) on the cheapest device. Scale up only after it finishes clean.
  8. Never pass the owner's cap. If the next step would, stop and ask.
- Do not pick between two trained models by their score on the test file. That is selection on the test set. Pick on val, then report test as it is.
- Check the class share in the train file against the real share before you train. Weighting a rare class twice on top of adding seeds of that class moved needs_human from about 11% to 34%; it was fixed to 23% before the run.
- A metric helper that loops over the questions of the test file will crash when a question is absent from train (refund and at_risk run as code). Test the helper for missing questions, and save raw predictions before any report code runs: the CPU eval took 12 minutes to redo.
- One seed in the test file can be 18% of a class. When recall moves in steps like that, the number is a coarse signal; look at which seeds miss before you retrain.
- A claim about a vendor's error case (linkIdentity on a taken Google account) can be absent from its docs. Do not build on it; pick the path that does not depend on it, and log the proof as a follow-up (F114).
- #128 was built on #124 without telling GitHub it was a stack, so #124 merging meant a hand rebase of #128. A `gh stack` layer would have rebased itself and kept its approval.
- A stack of PRs needs the next layer cut from the one under review, and a rebase with `git rebase --onto origin/dev <old head>` after each squash merge. Keep the old head's hash before you rebase.
- n8n code nodes have no `URL` class. A node that parsed an address with it skipped every target without an error. Test the code in the same sandbox rules, with a case that must send.
- A screen test that asserts an internal id on screen blocks a design rule. Assert the rule (no id on a customer screen), not the id.
- macOS `sed -i` needs an empty string (`sed -i ''`). In a `&&` chain, one failed step hides the next ones; look at every exit code.
- When you swap many buttons for one component, pair each open tag with the next close tag, then run lint and all e2e. Timing tests can fail under load; run the failing one alone before you call it a break.
- A production database that already has tables is refused by `release_db.py`. A later release needs a `--from` option, or the migrations go one at a time through the Management API.
- An animated heading must keep the same markup on the server and in the browser. Swapping a plain heading for animated spans after the page loads made the last paint late: Lighthouse mobile LCP fell from 1.8 s to 3.6 s and the score from 99 to 86.
- Run axe after the animations end or under reduced motion. Half-faded words fail the contrast check although the finished page passes.
- A nav rule `a { color: inherit }` beats a button class on a link. The canvas had it too: the Pre-register button was dark text on green, 1.98 to 1.
- Lighthouse on a laptop with a load average near 20 gave scores from 29 to 99 for the same build. Check `uptime` and run twice before you trust a score.
- A web font that loads after the first paint moved the hero and gave a layout shift of 0.26. Self-hosted Latin subsets with preload took it to 0.
- Never run `git checkout -- .` to "check" state. It discards all uncommitted work.
- In one SQL statement the subqueries see the data as it was at the start, even after a function in the same statement wrote rows. A proof check must call the function in one statement and read in the next.
- The zip the reviewer sends may sit in Downloads and never get unpacked. Look there before you say a file is missing.
- A report that falls back to "the input item" when the right node failed can show the wrong period as the current one. Read each period by node name, and say "could not read" when it is missing.
- A commit made while another branch is checked out lands on that branch. After `git checkout`, run `git branch --show-current` before you commit. H10a was committed on the pins branch and the PR looked empty.
- A CSS comment with `#193` looks like a hex colour to the "no hex" test. Write the story as "story H10b" without the hash in CSS files.
- Guard checks every commit subject on the branch, not just the last one. A 74 char subject failed CI after the second commit passed locally. Run `python3 scripts/guard.py msg "<subject>"` before each commit, and keep subjects under 72 chars including the `(#issue)` tail.
- A migration that adds a check constraint fails on old rows. Run a read-only count of rows that break the rule on prod first, fix the data with the owner, then apply. The owner's data fix (a pin code) came in one line once the question was concrete.
- A thread reply must say only what was run. One reply on #220 said the customer flow was exercised on prod when only a read-only check was made; corrected in a second reply. Before writing "was tested", point at the command and its output.
- A release branch takes `app/` from dev with `git checkout origin/dev -- app`, but that never deletes a file dev removed. Run `git diff origin/dev --name-only --diff-filter=A -- app` and `git rm` those too, then the empty-diff check is honest.
- A review fix on a release branch must also land on dev (cherry-pick onto the next feature branch), or the next release's empty-diff check fails and the fix is lost on the next promote.
- In this folder the zsh `gh()` wrapper sets GH_TOKEN to the dev account, so `gh auth token --user satvik-jain-iitd` run from zsh returns the dev token and a review posts as the coder (PR #221, review 5638994807, body corrected). Post reviews through a bash script, or `unset GH_TOKEN; command gh auth token --user <login>`, and read `gh api user` back before posting.
- A new CSS class must be grepped in `ui.css` before it is added. `.ui-section` and `.ui-dot` already existed (menu sections, veg dots); the kitchen group and the online dot got their own names (`.ui-group`, `.ui-state-dot`).
- A board row that is a tap and holds a button cannot be one `<button>` (nested buttons are invalid). Split it: one button to open the ticket, one for the step, side by side.
- Fit-check shots count toward the 50 file cap. Nine boards times two themes times app and board is 36 files. Keep Day shots only; the Night axe check proves Night.
- `getByRole("heading", { name: "New" })` matches "No new tickets" too. Use `exact: true` on short headings, and a class locator (`.ui-tag`) for a word that is also a heading or a tab.
- Guard reads every commit on the branch, docs commits too. Twice today a docs subject went over 72 chars and turned CI red after the code passed. Run `python3 scripts/guard.py msg` on each subject before pushing, or make it a pre-push hook.
- A stacked layer merged into a base branch that was itself already merged never reaches dev. #228 was merged into feat/224 at 18:08:20, thirteen seconds after #227 (feat/224) had gone into feat/194-h11-review; #226 then carried #227 but not #228. Merge bottom up and check `git log origin/dev` for the top layer's change before closing the stack; GitHub shows MERGED either way.
- The same loss twice in one night (#228, #233): GitHub's retarget after a bottom merge is not instant, and a layer merged in that gap goes into a dead branch. The coder now retargets the next layer with `gh pr edit <n> --base dev` and says "base is dev" before the owner merges; PLAN.md rule 19 carries it.
| 2026-10-25 | A day boundary is a business rule, not the phone's date. `toDateString()` split one night shift in two; the fix is one function (`dayOf`) that both screens call, so the two cash numbers cannot drift. Test the boundary at both sides (01:59 and 02:00). |
| 2026-10-25 | Chrome that "sits below the fold" is still on the page. The old shell hid under a 100dvh frame; every test passed, the owner found it with one thumb scroll. Rule now: nothing under a board; a Playwright check scrolls each app to the end and expects nothing. | reviewer, #242 |
| 2026-10-25 | A generated file that a timer rewrites must not be tracked. The roadmap job would have dirtied the working tree every 15 minutes on every branch and blocked `git checkout`. Generated output: gitignored, with a README that says how to build it. | reviewer, #240 |
| 2026-10-25 | An axe contrast scan that runs during a CSS animation reads a blended colour and fails at random (the stamp's 90 ms fade-in). Before any axe scan, wait for `document.getAnimations()` to finish, in one shared helper. Red CI on a docs-only diff = look for timing, not the diff. | reviewer, #240 |
| 2026-10-25 | A launchd job that reads ~/Documents or ~/Desktop must use `/usr/local/bin/python3` (or another interpreter the owner already allowed) and absolute paths; the Xcode CLT `/usr/bin/python3` gets "Operation not permitted" from TCC. "Bootstrap failed: 5" after the job ran once is not a load failure; check `launchctl print` and the log. | reviewer, F156 |
- The chrome hid under the fold; the owner found it by scrolling (#242, 25 Oct 2026). Every board test asserted what was on the screen, none asserted what was below it. A phone test that scrolls to the end of every screen (ux-pass D1) now guards it. Second lesson: an axe scan that runs during a CSS animation reads the mid-frame colours; wait for `document.getAnimations()` to finish before scanning.
- A day boundary is a business rule, not the phone's date (#229, 25 Oct 2026). `toDateString()` split one night shift in two; the fix is one function (`dayOf`) that both screens call, so the two cash numbers cannot drift. Test the boundary at both sides (01:59 and 02:00). A write that touches more rows than the screen shows (the hand-over rpc stamping older days) needs the screen to show those rows too.
- A `&&` chain that starts with `git checkout` writes nothing after the checkout fails (#188, 25 Oct 2026). Migration 0028 was lost that way and found only when the apply step said no such file. Stash the docs the reviewer left, switch, pop, then write files, as separate commands; check `git status` lists every new file before the red run.
- A flag on a table is only half a rule (#258 review, 25 Oct 2026). `synthetic` on riders and kitchens did nothing for dispatch until `dispatch_candidates` and `assign_rider` matched the two flags. When a row gets a kind, grep every join that pairs that table with another and decide, per join, whether the kinds must match.
- A test of a random process must run more than once (#189, 25 Oct 2026). The tether check failed 2 of 3 runs before the fix (a random walk sometimes walks the right way), then 3 of 3 after. Red for a random rule = several runs, written down. Also: `select (expr) from t as v` names the table, not the column; write `select (expr) as v from t`.
- `getByLabel("Kitchens")` also matches "Kitchens open %" (#190, 25 Oct 2026): Playwright's label lookup is a substring match, so a form with two labels that share a word needs `exact: true`. And a 'no database call' assertion must name the calls it means (`sim_*`), because the screen's own reads (is_admin, numbers) are database calls too.
- A stacked layer above a squash-merged layer conflicts on every append-only doc (#260, 25 Oct 2026). #259 landed as one squash; #260 still carried #259's own commits and the same appended rows, so nine docs files conflicted on the merge page. Rule: right after the bottom layer merges, rebase the layer above with `git rebase --onto origin/dev <last bottom commit>`, push, then tell the owner to merge; never let him open the merge button on a stale stack.
- An n8n Respond to Webhook node wants a JSON string, not an object (#261, 25 Oct 2026). MAIN 30's result node had `responseBody: '={{ $json }}'`; every execution showed success and the edge answered 502 to every call. MAIN 01 uses `JSON.stringify(...)`; copy the working node, do not write a new one.
- A test that calls the database function directly cannot see the workflow node after it (#264, 25 Oct 2026). sim_check.py proved all five sim functions on dev and prod, yet every webhook answer was a 502: SUB 30's shared Shape result node knew only order and rider answers and turned a good sim answer into database_error, and Cloudflare replaced that 502 body with its own page. My first fix (JSON.stringify in the Respond node, #262) was a guess from the symptom; the execution data (Seed or reset output ok, Shape result 502) showed the real cause in one call. Read the execution before writing the fix, and test the whole webhook once per new action, not only the functions.
