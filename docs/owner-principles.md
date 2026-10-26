# The owner's principles

How the owner decides, in plain words. Each one has a source and an example from this project, so an agent that has to decide for him can check it. It is a draft: the owner marks each line right, wrong or "only sometimes" in the last column of `docs/discussions/cos-decisions.md`. A principle that is wrong is marked wrong, never deleted.

| # | Principle | Example | Source |
|---|---|---|---|
| 1 | One task at a time. Say one thing to do, wait, check that it happened, then say the next. | A merge, a click, a paste: one line each, never a list. | CLAUDE.md, 25 Oct 2026 |
| 2 | Ship the small thing now. Park the rest with a label. No big design before it is needed. | The PWA is frozen as MVP2; new ideas get the label `later`; the "edited" trigger for CI is story #92, not built. | PWA freeze 26 Oct; #90 on 27 Oct |
| 3 | Reuse before you build. Look for what exists, adopt it, then build only the gap. | The radar rule: no radar run, no new code. The one roadmap engine ports GoServe's own roadmap into ShipQuick instead of starting again. | CLAUDE.md, 25 Oct; ID213 |
| 4 | The owner's named choice is fixed. Make it work; do not swap it, not even to compare. | He named `gemma3:1b`; running another size to compare was wrong. | CLAUDE.md section 14, 7 Oct |
| 5 | Prove it with a test before you say it works. A claim without a test is a guess. | Every fix starts with a red test. "Works" is said after the check passes. | CLAUDE.md section 10 |
| 6 | Try it on the real thing. A demo must run twice with no error before it is shown. | The M.5 rehearsal on prod found three bugs that unit tests did not. | M1 exit check; 26 Oct |
| 7 | The owner merges. Agents review and open pull requests. The only exception is a merge he allows in his own words for that one pull request. | The reviewer merged #474 only after "haan to isme bas merge krdo". | Rules 17 and 19; 26 Oct |
| 8 | Looks must be consistent. Use the design tokens and existing classes; do not invent new values. | "Buttons hug the fields, consistency is lost": the Simulator tab now uses the same form classes as City. | Story #461, 26 Oct |
| 9 | Words a stranger can read. Short sentences, simple words, one idea per sentence. | Artifacts are Grade 5 English; the roadmap text is the business line of each story. | CLAUDE.md section 1 |
| 10 | Never delete a row. Mark it outdated or wrong and add the correction. | Trace rows, learnings, ideas and the second brain only grow. | CLAUDE.md sections 9 to 11 |
| 11 | Keep the owner's risk small. A test must not risk his main accounts, money or live data. | Tests use a burner, a copy or a dry run; prod writes are done by the owner, not by an agent. | CLAUDE.md section 10 |
| 12 | Build for ten years. Open formats, plain files, native on the current chip. | Markdown, JSON and SQLite; Apple silicon only. | CLAUDE.md section 13 |
| 13 | New abilities go in the new app; the old one stays frozen. | Staff in several kitchens (ID212) is built in backend v2 and the native apps, not in the PWA. | ID212, 26 Oct |
| 14 | Say it once and short. After work, say only what is needed from him. | No recaps unless he asks. | CLAUDE.md section 1, 7 Oct |
| 15 | Start with the end goal. Every project has a live roadmap from day one, written for a stranger. | The roadmap page goes up with the first epic. | CLAUDE.md section 1, 25 Oct |
