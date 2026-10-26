# Chief of Staff decisions

The reviewer session decides the way the owner would when he is away (idea ID221, the lite version). Every such decision is one row: what was asked, what was chosen, why the owner would choose it (a principle from `docs/owner-principles.md`), and how sure the reviewer was. The owner fills the last column when he sees the row. Rows are never deleted: a wrong decision is marked wrong.

| Date | Question | Decision | Satvik would choose this because | Confidence | Owner verdict |
|---|---|---|---|---|---|
| 2026-10-27 | ShipQuick #90: CI cannot see an edited pull request body (a re-run reuses the old text). Push a tiny commit, or change the CI trigger first? | (a) one tiny commit (trace row reworded) now. (b) adding `edited` to the pull_request types is story #92, label `later`. | Ship fast, no over-engineering now (principle 2). | 0.9 | |
