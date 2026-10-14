# PR #77 — fix(app): show the autopilot refusal, name the cost line

- **Branch:** `feat/47-scorecard-fixes` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** Follow-up to #47 (PR #76), no new story
- **Status:** MERGED into dev `d3d4cbe` on 14 Oct 2026 18:07Z (APPROVE review 5522357927, head `42f3cce`, CI green); 4 threads answered and resolved [VERIFIED]
- **Files:** 9 · **Lines:** +23 / -12 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5522357927 (APPROVE), 4 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/77

> Hotel ke night manager ka note card: jab ek desk mana kare, wajah switch ke paas bhi likhi jaati hai, sirf desk par nahi.

---

## Overall review

## 1. Ek-line logline
> `Fix PR: autopilot ka refusal ab DemoBar par dikhta hai, scorecard ki reads naye pages pehle laati hain, aur cost line saaf naam leti hai.`

## 2. Big Picture (Story & Goal)
- Nayi story nahi. Yeh PR #76 (story #47, epic #35) ke threads ka follow-up hai. [VERIFIED brief]
- Founder ke tab par ab bhi autopilot ka refusal dikhta hai, aur owner ki slip par cost ki line saaf bolti hai ki kin calls ka cost hai. [VERIFIED code read]

## 3. Yeh ab aaya kyun? (Context)
- PR #76 merge ho chuka hai (`f4aad24`, 17:49Z), uske 17 threads answered aur resolved hain. [VERIFIED brief]
- Refusal text customer tab par nahi dikhta tha: `live.setError` sirf kitchen, rider aur ops screens par dikhta hai. [VERIFIED spec; INFERRED red run]
- Scorecard ki read `limit=1000` par `order` nahi maangti thi, to cut page kaunsi rows dega tay nahi tha. [VERIFIED]

## 4. Real-Life Analogy
Hotel ka raat ka kaam. Ek switch, ek clerk, ek bill line.

1. `autoNote` = drill switch par chhota note card: desk mana kare to wajah switch ke paas bhi likhi jaati hai.
2. `order=created_at.desc` = ledger clerk pehle naye pages padhta hai, to sheet bhar jaaye to subah ke pages pehle bahar jaate hain.
3. "Cost of all calls" = slip ki bill line: batati hai ki jod mein kaun si calls hain, lobby ke health rounds bhi.

## 5. Is PR mein naye Concepts (3)
- Return the message with the code: caller ko wajah chahiye, sirf code kaafi nahi. [VERIFIED brief]
- Assert where the user looks: test wahan ho jahan founder dekhta hai. [VERIFIED brief]
- Ordered reads under a cap: `order` ke bina cap wali read ek lottery hai. [VERIFIED brief]
Poori entries `concepts.delta.md` mein hain.

## 6. High-Level Flow
Journey: ek refusal, desk se night manager ke note tak.

1. Autopilot tick → `doAct` → server 503 → `act` `{ code: "kill_switch", message }` return karta hai, aur kitchen, rider, ops par `live.setError` se bhi dikhta hai. [VERIFIED brief]
2. Loop `autoNote` = message set karta hai aur ruk jaata hai; DemoBar har tab par note dikhata hai, Autopilot button ke neeche. [VERIFIED code read]
3. Scorecard: flow wahi hai; SUB 91 ki reads naye pehle aati hain, cost line ka naam saaf hai. [VERIFIED brief]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `app/src/App.tsx` | Drill switch ka desk: `act` ab code aur message dono deta hai; loop refusal ko `autoNote` mein rakh kar ruk jaata hai · +10/-6 |
| `app/tests/e2e/autopilot.spec.ts` | Inspector: 503 spec ab check karta hai ki refusal text dikhe · +1 |
| `ops/n8n/order/build.js` | Ledger clerk ka form: SUB 91 ki read ab newest pehle · +1/-1 |
| `ops/n8n/order/code/score_message.js` | Slip ki bill line: "Cost of all calls" · +1/-1 |
| `ops/n8n/order/scorecard.test.js` | Test: message text aur read URL pinned · +2/-2 |
| docs (`integrations/n8n-order-workflows.md`, `follow-ups.md` F79, `LEARNINGS.md`, `process-trace.md`) | Notebook ki rows: F79 a–f, 1 LEARNINGS line, trace rows 180–181 |

## 8. Pieces aapas mein kaise baat karte hain
- App: `doAct` → `act` → autopilot loop → `autoNote` → DemoBar. Kitchen aur rider ke tap callers `act` ka return ignore karte hain. [VERIFIED code read]
- Ops: SUB 91 ki read ab `order=created_at.desc` ke saath; baaki scorecard flow same hai. [VERIFIED brief]

## 9. Pehle se kya badla
- 9 files, +23 / -12. [VERIFIED]
- `act` ka return `string | null` se `{ code, message } | null` ho gaya. [VERIFIED code read]
- Do chhote text badlav: read mein `order=created_at.desc`, aur cost label "Cost of all calls" (tests bhi badle). [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Refusal text do baar.** Kitchen, rider aur ops par screen error aur button ke neeche note, dono. Impact: stage par cosmetic. Check: `App.tsx` lines 104–106 aur 138. [VERIFIED code read]
2. **Newest-first read.** 1000+ rows wale din par subah kat jaati hai, aur truncation note abhi "first 1000 runs only" kehta hai. Impact: sirf shabd. Check: `build.js` line 247, `score_message.js` line 17. [VERIFIED]
3. **Agla story slot khaali.** Reviewer ka #42 pick galat tha: #42 PR #63 mein ho chuka hai (13 Oct, `844dea7`). Reviewer ne open issues dekhe, merged PRs nahi. Impact: coder ruk sakta hai agar owner dheema ho. [VERIFIED brief]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Window fix (F79 a). Kyun: owner shape chunega (rolling 24 h ya cron 23:55). [VERIFIED brief]
- MAIN 90 ki apni run_log row (F79 b). Kyun: owner ka faisla, B13.2 ke against hai. [VERIFIED brief]

## 12. Testing Story
- Red pehle: PR body ke mutabik reason assert (`toBeVisible`) fail hua, aur do scorecard tests (cost label, read URL) bhi pehle fail hue. [VERIFIED quote, INFERRED run]
- Reviewer ne `42f3cce` par dobara chalaya: node 62/62, tsc clean, vitest 79/79, playwright 50/50 (test build `VITE_AUTOPILOT_MS=300`). [VERIFIED]
- Covered nahi: naya kuch nahi; live rows activation ke baad aayengi. [VERIFIED brief]

## 13. Trade-offs & Alternatives
- Chuna: message return value mein. Chhoda: shared error store. Kyun: ek hi caller ko chahiye, teen lines. Gave up: teen tabs par same text duplicate. [VERIFIED brief]
- Chuna: newest-first cut, paging nahi. Kyun: ek query parameter. Gave up: 1000+ din ki subah (F78 e). [VERIFIED brief]

## 14. Patterns is PR se
- **Reason saath:** code aur message ek hi object mein. Desk ki slip par wajah bhi likhi hoti hai. `app/src/App.tsx`.
- **Assert where the user looks:** refusal text founder ke tab par test hota hai. `app/tests/e2e/autopilot.spec.ts`.
- **Ordered read under a cap:** `order` ke bina `limit` lottery hai. `ops/n8n/order/build.js`.

## 15. AI-Review Lens
- **Trust:** assert jo gap pakdi, pinned query tail, tsc on the new return type. [VERIFIED brief]
- **Interrogate:** kya note screen error ki jagah le (kitchen, rider, ops); aur "first 1000 runs" shabd ab "latest 1000" hona chahiye ya nahi. [VERIFIED brief]

## 16. Questions
- **Top abhi poocho:** sirf ek TOP sawaal hai: `app/src/App.tsx` line 138, stage par refusal do jagah (note aur screen error). Baaki teen sawaal comment blocks mein hain.
- **Poora bank:** 4 sawaal, comment blocks mein, question order mein (neeche).

## 17. Self-check (light, 2)
- Refusal ab kin tabs par dikhta hai, aur kya stage par ek hi text do jagah theek hai? (TOP-1.)
- 1000 se zyada rows wale din `order=created_at.desc` kya bachata hai, aur kya kat jaata hai? (Risk 2.)

---

## Comment blocks (4 posted, review 5522357927, har block mein GitHub id)

<!-- gh-comment-id: 4274416699 --> `app/src/App.tsx:138` · Understanding · **Top-3**
> Refusal par ab `autoNote` mein server ka message jaata hai aur loop rukta hai; DemoBar har tab par note dikhata hai. Par kitchen, rider aur ops tab par `live.setError` (line 105) wahi text pehle se dikhata hai: ek hi refusal do jagah. Stage par theek hai, ya in teen tab par note chhupana chahiye? Owner ka call, ek line.
- **Reply (klickbae8yt-star):** It is the same text twice on the kitchen, rider and ops tabs: once under Autopilot and once at the top of the screen. I left it, because on stage the founder may be on any tab and the Autopilot note is the one place that is always there. The owner can ask me to hide the second copy.
- **Status:** answered

<!-- gh-comment-id: 4274416717 --> `app/tests/e2e/autopilot.spec.ts:113` · Testing
> Ek `toBeVisible` ne asli gap pakda: text sirf kitchen/rider/ops par tha, customer tab par nahi. Sabak: "reason stays on screen" jaisa daava hamesha us tab par assert ho jahan founder dekhta hai. Yeh LEARNINGS mein hai (line 125). Theek.
- **Reply (klickbae8yt-star):** Thanks. The lesson is in LEARNINGS: a claim like "the reason stays on screen" is asserted on the tab where the founder looks.
- **Status:** answered

<!-- gh-comment-id: 4274416730 --> `ops/n8n/order/build.js:247` · Understanding
> `order=created_at.desc`: cut hone par sabse nayi 1000 rows, subah ki rows pehle girti hain. Par message abhi bhi "first 1000 runs only" kehta hai (score_message.js line 17): ab "latest 1000" sahi shabd hai. Ek shabd, agle PR mein.
- **Reply (klickbae8yt-star):** Agreed. I will change the wording to "latest 1000" together with the window fix, once the owner picks the window (rolling 24 hours or cron 23:55).
- **Status:** answered

<!-- gh-comment-id: 4274416743 --> `docs/follow-ups.md:86` · Docs
> F79 a: window ka fix owner ke pick par (rolling 24 h ya cron 23:55); b: MAIN 90 apni run_log row nahi likhta (B13.2), owner ka faisla. Ek note: agla story slot abhi khaali hai; reviewer ka #42 pick galat tha (PR #63 mein 13 Oct ko ho gaya tha). Coder ka "prod release prep" story owner ke teen haan ke baad hi (rule 16 gate).
- **Reply (klickbae8yt-star):** Understood. The story slot stays empty. I will open the "prod release prep" story only after the owner's three yeses (Cloudflare project, prod migrations, prod n8n copy), as the rule 16 gate asks.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #77 approve hai. Merge karo (feat/47-scorecard-fixes -> dev). Window ka shape chuno: rolling 24 h ya cron 23:55.
Coder ke teen prod sawaal in order mein jawab do (Pages project `goserve-app`; prod migrations 0001–0007 + anonymous sign-in; prod n8n "deploy twice"). Issue #47 close karo.
"push kar do" aur "activate" abhi alag shabd hain. A46–A50 khule hain.
```

Coder paste-block (English):
```
State: PR #77 APPROVED (review 5522357927, 4 threads). Owner merges.

1. Answer the 4 threads by id.
2. Once the owner picks the window shape, change one word in score_message.js: "latest 1000".
3. After merge, copy the bundle and append the rows.
4. Next: the "prod release prep" story only after the owner's three yeses (rule 16). Until then, wait for "push kar do" / "activate" and #56.
```

posted as satvik-jain-iitd, review 5522357927, 4 inline threads
