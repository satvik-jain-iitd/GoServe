# Design skills: which one to trust

**Date read:** 22 Oct 2026. Counts come from the GitHub API (tier A for the numbers). Reviews are tier C. No first-hand Reddit or Hacker News posts were found, so there is no tier P.

| Repo | Stars | Forks | Fork / star % | Age (days) | Commits in 30 days | Contributors | Open issues | Licence |
|---|---|---|---|---|---|---|---|---|
| Leonxlnx/taste-skill (tasteskill.dev) | 100,706 | 6,813 | 6.8 | 245 | 75 | 21 | 3 | MIT |
| pbakaus/impeccable | 84,562 | 5,054 | 6.0 | 340 | 100 | 59 | 49 | Apache-2.0 |
| nextlevelbuilder/ui-ux-pro-max-skill | 138,606 | 14,689 | 10.6 | 326 | 15 | 102 | 90 | MIT |
| anthropics/skills (has `frontend-design`) | 182,819 | 21,653 | 11.8 | 395 | 5 | 16 | 1,424 | none listed |

| Claim | Evidence | Tier | Confidence | What it changes |
|---|---|---|---|---|
| Stars show reach, not quality | Star counts can be bought or spike. The growth curve could not be pulled (the stargazers call was refused) | A (numbers) | 0.8 | Do not pick by stars |
| Fork / star of 6 to 12 % is normal for a dev tool | All four sit in that range | A | 0.6 | No sign of fake stars, no proof of quality |
| taste-skill has 3 open issues for 100k stars | Little feedback flows back | A | 0.6 | Its reach is not proof of results |
| Impeccable is the strongest for critique and polish | Vendor and blog reviews; 27 rule checks, 20 commands, many contributors | C | 0.5 | First to test |
| ui-ux-pro-max is less AI-looking than frontend-design but slow | One hands-on test: 18 minutes, about twice the tokens | C | 0.4 | Last to test; it picks its own palettes and GoServe has fixed brand colours |
| No controlled benchmark exists for any of them | None found | C | 0.7 | We run our own test |

## Experiment (also logged in `docs/research/experiments.md` when it starts)

- **Hypothesis:** a design skill makes the customer menu and cart screens look better to the owner than the plain build.
- **Design:** same brief, phone width, brand tokens fixed. Four conditions: no skill, `frontend-design`, Impeccable, taste-skill. Same hour.
- **Measure:** a written checklist (hierarchy, spacing, real food photos, tap targets, contrast, loading states) and the owner's blind pick.
- **Decision rule:** keep the one the owner picks blind and that passes the checklist. If none beats the plain build, keep the plain build.
