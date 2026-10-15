# PR #79 — fix(ops): scorecard covers the last 24 hours

- **Branch:** `feat/47-scorecard-window` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** Follow-up to #47 (PR #76, #77), no new story. PR #78 nahi hai; #78 ek issue hai ("Production release prep"). [VERIFIED]
- **Status:** MERGED into dev `f1f5058` on 14 Oct 2026 18:38Z (APPROVE review 5522846805, head `7186f8a`, CI green); 9 threads answered and resolved [VERIFIED]
- **Files:** 19 · **Lines:** +592 / -59 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5522846805 (APPROVE), 9 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/79

> Hotel ke night auditor ne band karne ka waqt badal diya: ab slip hamesha pichhle 24 ghante ka hota hai, raat 12 baje ka nahi.

---

## Overall review

## 1. Ek-line logline
> `Fix PR: scorecard ab pichle 24 ghante ki slip banata hai, message saaf batata hai kaunsa period hai, aur live check ka naya script aaya jo sirf shape dekhta hai.`

## 2. Big Picture (Story & Goal)
- Owner ne 14 Oct ko window ka pick diya: rolling 24 h. Pehle 21:00 ke baad ki rows ka gap tha (F79 a). [VERIFIED brief]
- Owner ke "push kar do" se dus workflows update hue, sab inactive; naye ids teen hain (SUB 16, SUB 91, MAIN 90). [VERIFIED brief]

## 3. Yeh ab aaya kyun? (Context)
- Pehle message "first 1000 runs" kehta tha; ab "latest 1000" hai, kyunki cut hamesha newest rows ka hota hai. [VERIFIED]
- Naya `verify_live.js` (21 lines) PR mein aaya: read-only live check, dus workflows ke liye. [VERIFIED brief]

## 4. Real-Life Analogy
Hotel ka raat ka kaam. Ek slip, ek time stamp, ek inspector.

1. `score_window.js` = night auditor: ledger raat 12 baje band nahi hota; slip hamesha pichhle 24 ghante ka hota hai.
2. `until_label` = slip par time stamp: "to 14 Oct 21:00 India time".
3. `verify_live.js` = inspector: ten desks ginta hai, check karta hai har desk apni jagah par hai aur corridors same hain; drawers nahi kholta. Furniture ke covers abhi laga hai (inactive); "activate" = front door aur auditor ka alarm clock on.

## 5. Is PR mein naye Concepts (3)
- Rolling window: "last 24 hours" send ke waqt se ginna. [VERIFIED brief]
- Read-back after deploy: likhne ke baad wapas padh kar compare karna. [VERIFIED brief]
- Label the period on the report: report par likho kaunse ghante cover hue. [VERIFIED brief]
Poori entries `concepts.delta.md` mein hain.

## 6. High-Level Flow
Journey: ek slip, raat ke auditor se Telegram tak.

1. 21:00 India: MAIN 90 chalta hai; Prepare window: `since` = abhi se 24 ghante pehle, `until_label` = "2026-10-14 21:00". [VERIFIED brief]
2. SUB 91 newest 1000 rows padhta hai; Summarise; Format message naye head ke saath; Telegram. [VERIFIED brief]
3. Apply ke baad `verify_live.js` dus workflows ko GET karta hai, live ids se build banata hai, positions aur links compare karta hai, aur layout check chalata hai. [VERIFIED brief]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `ops/n8n/order/code/score_window.js` | Auditor ka time ka hisaab: `since` = now − 24 h, `until_label` India time mein · +4/-5 |
| `ops/n8n/order/code/score_message.js` | Slip ka head aur khaali, fail, cut wale texts · +4/-4 |
| `ops/n8n/order/build.js` | Sticky-note wording ("last 24 hours", "newest 1000"); nodes aur edges same · +4/-4 |
| `ops/n8n/order/scorecard.test.js` | Test: window aur message texts pinned · +15/-10 |
| `ops/n8n/order/verify_live.js` (naya) | Inspector: active flag, positions, links, layout; parameters nahi · +21 |
| docs aur notebook (`assumptions.md` A50, `follow-ups.md` F79 a, n8n doc, test-cases, discussions, chapters 17–18) | Rekhaad: owner ke 14 Oct ke faisle aur ids [VERIFIED brief] |

## 8. Pieces aapas mein kaise baat karte hain
- MAIN 90 → score_window (time) → SUB 91 (rows) → score_message (text) → Telegram. [VERIFIED brief]
- `verify_live.js` sirf read karta hai (PUT, POST, DELETE file mein nahi); ten workflows ko naam se dhoondhta hai. [VERIFIED code read]

## 9. Pehle se kya badla
- 19 files, +592 / -59. Code mein: score_window +4/-5, score_message +4/-4, build +4/-4, test +15/-10, verify_live naya +21. [VERIFIED]
- Node ya edge nahi badle; build.js mein sirf sticky-note text badla. [VERIFIED brief]

## 10. Macro Risks & Downstream Impact
1. **Shape-only compare.** Aadha fail hua PUT purana Code node chhod de, to bhi "same" chhapega. Demo din "deployed = committed" galat ho sakta hai. Check: `verify_live.js` lines 16–17. [VERIFIED]
2. **Manual run beech mein.** Execute workflow se overlapping card banega; head mein time likha hai, to padhne wala samajh sakta hai. Check: `score_window.js` line 6. [VERIFIED]
3. **Activation ka asar.** MAIN 01 public webhook hai (F65 d rate limit abhi khula hai) aur MAIN 90 roz Telegram bhejta hai. Owner ka "activate" asli asar dega. [VERIFIED brief]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Activation: owner ka "activate" chahiye. [VERIFIED brief]
- Parameter compare in `verify_live`: should-fix, agle PR mein. [VERIFIED brief]
- Canvas ki look editor mein: coder ke paas n8n login nahi; owner har editor khol kar fit view dabaye. [VERIFIED brief]

## 12. Testing Story
- Red pehle: PR body ke mutabik 12 mein se 3 scorecard tests pehle fail hue (window, head, wording). [VERIFIED quote, INFERRED run]
- Reviewer ne `7186f8a` par node 62/62 chalaya; `verify_live` ki dus lines sab "same", clean, inactive. [VERIFIED]
- Covered nahi: node parameters, asli 21:00 fire, owner ki canvas look. [VERIFIED brief]

## 13. Trade-offs & Alternatives
- Rolling 24 h, cron 23:55 ki jagah. Kyun: owner ka pick; koi ghanta nahi chhutega. Gave up: "aaj" wala shabd. [VERIFIED brief]
- 21 lines ka read-only script, bada deploy read-back nahi. Kyun: ponytail; `build()` aur `checkLayout` dobara use hue. Gave up: parameters. [VERIFIED brief]
- User-Agent hard-coded. Kyun: n8n host par kuch rokta hai (wajah file mein nahi likhi). Gave up: comment. [VERIFIED brief]

## 14. Patterns is PR se
- **Read-back after deploy:** likhne ke baad padh kar compare karo. `ops/n8n/order/verify_live.js`.
- **Label the period:** report par period likho. `ops/n8n/order/code/score_message.js`.
- **Dry run before the real push:** `deploy.js` dry run ne dus "update" dikhaye, phir "push kar do" hua. [VERIFIED brief]

## 15. AI-Review Lens
- **Trust:** window ka hisaab (teen waqt par test hua), live read-back shape ke liye, docs ke ids (dry run se mel khaate hain). [VERIFIED brief]
- **Interrogate:** verify_live mein "same" kya cover karta hai; ek assert jo kabhi fail nahi hoga; User-Agent ki wajah. [VERIFIED brief]

## 16. Questions
- **Top abhi poocho:** teen sawaal: verify_live ka "same" (Risk), rolling window ka overlap (Understanding), aur A50 par owner ki haan ya na (Assumptions).
- **Poora bank:** 9 sawaal, comment blocks mein, question order mein (neeche).

## 17. Self-check (light, 2)
- `verify_live.js` ka "same" kin cheezon ko dekhta hai, aur kin ko nahi? (Risk, TOP-1.)
- Manual run ko 21:00 wale card se alag kaise pehchaanoge? (Understanding, TOP-2.)

---

## Comment blocks (9 posted, review 5522846805, har block mein GitHub id)

<!-- gh-comment-id: 4274777271 --> `ops/n8n/order/verify_live.js:16` · Risk · **Top-3**
> `pos` aur `conn` sirf naam + position aur links milate hain; node ke `parameters` (Code source, URL, credential id) nahi. Aadha fail hua PUT purana Code node chhod de to bhi "same" chhapega. Rulebook 97: live JSON = last committed build. Ek line: `[n.name, n.type, n.parameters]` bhi compare karo (agle PR mein). test-cases ki row ka wording ("nodes, positions and links") abhi sahi hai.
- **Reply (klickbae8yt-star):** Done on the next branch (story #78). `verify_live.js` now compares each node's name, type, parameters and credentials, built with the real deploy-time values (kept in memory, never printed). All ten live workflows are the same as the build.
- **Status:** answered

<!-- gh-comment-id: 4274777285 --> `ops/n8n/order/code/score_window.js:6` · Understanding · **Top-3**
> `since = now − 24 h`: 21:00 par card kal 21:00 se aaj 21:00 tak. Har ghante ki row kisi na kisi card mein (gap band). Par editor se "Execute workflow" beech mein chalao to us pal se 24 h ka overlapping card banega: head mein time likha hai, to padhne wala samajh lega. Theek?
- **Reply (klickbae8yt-star):** Yes. A manual run in the editor makes a card for the 24 hours before that moment. The head names the time it is for, so the reader can tell it from the 21:00 card.
- **Status:** answered

<!-- gh-comment-id: 4274777293 --> `docs/assumptions.md:60` · Assumptions · **Top-3**
> A50 ab rolling 24 h kehta hai (owner ka pick 14 Oct); baaki wahi: pure system ki rows, pairs, health alag, sirf numbers, sirf goserve-dev. Owner se haan ya na abhi bhi baaki.
- **Reply (klickbae8yt-star):** This needs the owner's own yes, apart from the merge. A50 stays Open until then.
- **Status:** answered

<!-- gh-comment-id: 4274777304 --> `ops/n8n/order/verify_live.js:8` · Ops
> `User-Agent: curl/8.7.1` har call par: kyun? n8n host par default Node fetch block hota hai? Ek comment line mein wajah likho, warna agla banda hata dega aur script toot jaayegi. Script writes nahi karti (PUT/POST/DELETE kahin nahi) — VERIFIED.
- **Reply (klickbae8yt-star):** Done, with an honest comment. It is the same User-Agent that deploy.js sends. I checked on 15 Oct: a plain Node call also answers 200, so it may not be needed. It stays so the two scripts behave alike if the host starts to refuse the default agent. The script only reads.
- **Status:** answered

<!-- gh-comment-id: 4274777315 --> `ops/n8n/order/scorecard.test.js:38` · Testing
> `assert.ok(Date.parse('…17:30Z') > Date.parse('…15:30Z'))` do constants milata hai, kabhi fail nahi hoga. Asli check line 37 hai (23:00 ki row agle card ke `since` ke baad). Line 38 ko "row pehle card ke `until` (= now) ke baad hai" bana do, ya hata do.
- **Reply (klickbae8yt-star):** Fixed. That line compared two constants. It now checks that the next card's `since` is exactly where the first card ended: no gap and no overlap.
- **Status:** answered

<!-- gh-comment-id: 4274777329 --> `ops/n8n/order/code/score_message.js:5` · Understanding
> Head ab period batata hai: "last 24 hours (to 2026-10-14 21:00 India time)". Yahi line manual run aur 21:00 wale card ko alag karti hai. "could not read the numbers" aur "latest 1000 runs only" ke naye text test mein pinned hain.
- **Reply (klickbae8yt-star):** Agreed. The head is the line that tells a manual run from the 21:00 card.
- **Status:** answered

<!-- gh-comment-id: 4274777336 --> `docs/integrations/n8n-order-workflows.md:13` · Docs
> Teen naye ids (SUB 16 `waOKwiTQNQWh96EW`, SUB 91 `ZOWAGbJv5hR1MDAe`, MAIN 90 `odx6zXlMhMh74JLw`) aur MAIN 01 "event and health routes": reviewer ke dry run aur verify_live se mel khaata hai. Ab "activate" ka matlab: MAIN 01 (webhook) aur MAIN 90 (schedule) on; SUB aur ERR 00 ko active karne ki zaroorat nahi (Execute Workflow se chalte hain). Sahi?
- **Reply (klickbae8yt-star):** Yes, as I understand n8n: sub-workflows called by an Execute Workflow node and an error workflow do not need to be active. So "activate" means MAIN 01 (webhook) and MAIN 90 (schedule). The first live run will prove it.
- **Status:** answered

<!-- gh-comment-id: 4274777345 --> `docs/tests/test-cases.md:125` · Docs
> Read-back row: "same nodes, positions and links" — sach, par parameters nahi. Jab verify_live parameters bhi milaye, row mein "parameters" jodo. Aur activate ke baad is row ke neeche live rows: health page, 21:00 message (ya Execute), ops decide, do device.
- **Reply (klickbae8yt-star):** Done. The row now says nodes, node parameters, positions and links, and that all ten were the same on 15 Oct. The live rows after "activate" go under it.
- **Status:** answered

<!-- gh-comment-id: 4274777352 --> `docs/discussions/2026-10-14.md:28` · Docs
> "shipquick rule" kya hai? Owner ne #39–#54 haath se band kiye kyunki PR dev mein merge hota hai aur issue khula rehta hai. Ek line mein: rule kahan hai aur fix kya hoga (PR body mein "Closes" ki jagah merge-to-dev par close?). Notebook ke liye.
- **Reply (klickbae8yt-star):** The rule is in the shipquick repo (`~/Documents/AI_Assistant/shipquick_latest`), not in GoServe. It says "Closes #N" in the PR body, which only closes the issue when the PR merges into the default branch (main). In GoServe PRs merge into dev, so issues stayed open. The fix I gave the owner as a prompt: if the base is not the default branch, close the linked story by hand after the merge, with a comment that links the PR, after one yes from the owner. Epics are never closed that way.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #79 approve hai. Merge karo (feat/47-scorecard-window -> dev).
Das workflows live hain par inactive. "Activate" = MAIN 01 + MAIN 90 on; phir live rows aur #56. Har ek ko n8n editor mein ek baar khol kar fit view dabao.
A46–A50 haan/na abhi khule hain; Pages project `goserve-app` aapka apna click hai (F61).
```

Coder paste-block (English):
```
State: PR #79 APPROVED (review 5522846805, 9 threads). Owner merges.

1. Answer the 9 threads by id.
2. Should-fix, next PR: verify_live.js compares node parameters too (add [n.name, n.type, n.parameters]); drop the constant assert in scorecard.test.js line 38; add one comment line for the User-Agent.
3. After merge, copy the bundle and append the rows.
4. Continue #78 prod release prep on feat/78-prod-release-prep.
5. If the owner says "activate", stop and run the live rows and #56 first.
```

posted as satvik-jain-iitd, review 5522846805, 9 inline threads
