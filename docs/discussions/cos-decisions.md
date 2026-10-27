# Chief of Staff decisions

The reviewer session decides the way the owner would when he is away (idea ID221, the lite version). Every such decision is one row: what was asked, what was chosen, why the owner would choose it (a principle from `docs/owner-principles.md`), and how sure the reviewer was. The owner fills the last column when he sees the row. Rows are never deleted: a wrong decision is marked wrong.

| Date | Question | Decision | Satvik would choose this because | Confidence | Owner verdict |
|---|---|---|---|---|---|
| 2026-10-27 | ShipQuick #90: CI cannot see an edited pull request body (a re-run reuses the old text). Push a tiny commit, or change the CI trigger first? | (a) one tiny commit (trace row reworded) now. (b) adding `edited` to the pull_request types is story #92, label `later`. | Ship fast, no over-engineering now (principle 2). | 0.9 | |
| 2026-10-27 | iPhone got no push with the app closed. Which statuses get a push, and how? | Ready, picked up (with the rider's name), delivered, plus placed. "Arriving" later, when the sim has a distance. One path: the database queues, one n8n sender drains (#483). | Principle 2 (small, now) and 17 (one way): the goal is "know when the food comes". | 0.75 | open |
| 2026-10-27 | Order again button: keep or remove? | Removed (owner's own words: one way, never two). The slip's one button is "See the menu" with an empty cart (#485). | Principle 17. | 1.0 (owner) | owner decided |
| 2026-10-27 | Supabase free-tier watch: wait for the owner's token or start now? | Phase 1 now with no new secret (SQL numbers, DB answers); phase 2 after the owner creates the Management token. Egress is a labelled proxy, never "x of 5 GB" (#488). | Principles 2 and 5: ship the part that is real, name the gap. | 0.8 | open |
