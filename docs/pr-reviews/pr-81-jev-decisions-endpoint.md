# PR #81 — fix(ops): ask Jev at the decisions endpoint, not chat completions

- **Branch:** `feat/46-jev-decisions-endpoint` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** refs #46 and #54, no new story [VERIFIED]
- **Status:** MERGED into dev `b05e663` on 15 Oct 2026 01:45Z (APPROVE review 5526169251, head `7152fea`, CI green); threads answered and resolved [VERIFIED]
- **Files:** 17 · **Lines:** +164 / -68 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5526169251 (APPROVE), 10 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/81

> Concierge ko galat phone line par bulaya ja raha tha. Pehli asli call ne bataya ki woh sirf decisions desk par sunta hai. Ab desk wahi hai, aur raat ka manager ek asli guest ko har desk se guzaarta hai.

---

## Overall review

## 1. Ek-line logline
> `Fix: Jev ko decisions endpoint par bulaya jaata hai, chat line par nahi. Test ke jawab asli jawab jaise hain, aur scripts/live_check.py ek asli order ko poore raaste se chalata hai.`

## 2. Big Picture (Story & Goal)
- Ye PR n8n ke order workflows mein Jev (AI decision model) ki call ko theek karti hai. Pehle call galat endpoint par thi. [VERIFIED]
- Refs #46 (rule pehle, Jev dusra; Jev down ho to rule aage jaata hai) aur #54 (health page Jev se ek chhota sawaal poochta hai). Dono ab asli endpoint ke saath khade hain. [VERIFIED]
- Koi naya story nahi. [VERIFIED]
- Agla story: #56 "20 of 20 scripted runs, founder Android check and backup video" critical path hai. #78 stacked PRs (#82 name check, #85 prod workflows) mein chalega. #83 role apps (PR #84) owner ka 15 Oct ka direction hai. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Pehle Jev ko chat completions line par bheja gaya tha. [VERIFIED]
- Owner ke "activate" ke baad coder ne sabhi das dev workflows publish karke pehli live checks chalayi. Jev ne SUB 13 aur SUB 16 dono par HTTP 400 diya: "typesafe/jev-1.13 is a decisions model and cannot be used with the chat/completions endpoint". [VERIFIED PR body, F81 a]
- Rule phir bhi chala (`jev_error`), jaisa design tha. [VERIFIED PR body]
- 63 tests ek galat shape ka fake test kar rahe the, isliye sab green the. [VERIFIED PR body]
- Activation ke liye n8n is version mein tab tak MAIN publish nahi hota jab tak uske SUB publish na hon. Isliye "activate" ka matlab sabhi das workflows, sahi order mein. [VERIFIED doc; error text is the coder's quote]

## 4. Real-Life Analogy
Hotel. Concierge (Jev) ka desk, guest ki list, aur raat ka manager. Ek hi duniya poore PR mein.

1. Concierge = Jev, jo pehle phone line par bulaya gaya tha.
2. Decisions desk = `https://openrouter.ai/api/alpha/decisions`. Concierge sirf yahin sunta hai: ek state sheet aur typed sawaal, typed jawab wapas, koi small talk nahi.
3. Deewar par recorded jawab = test fixtures, jo 15 Oct ke asli jawab copy karte hain.
4. Raat ka manager ka walk = `scripts/live_check.py`. Ek asli order ko har desk se guzaarta hai aur har step par PASS ya FAIL tick karta hai.
5. Maintenance crew = `deploy.js`. Jo desk pehle se khula hai use refit kar sakti hai, par open sign kabhi nahi palti.
6. Front desk band rehta hai = activation note. Hotel ka front desk tab tak nahi khulta jab tak uske back office khule na hon.

## 5. Is PR mein naye Concepts (5)
- **Decisions endpoint vs chat endpoint:** Decisions model state aur typed sawaal leta hai, aur typed jawab deta hai. Chat prompt yahan nahi chalta.
- **Fixtures from real answers:** Test ka fake asli jawab ki shape copy kare. Ek invented fake ne galat endpoint ko ek din chhupaya.
- **Publish needs the callees published:** Is n8n version mein MAIN tab tak publish nahi hota jab tak SUB publish na hon.
- **wasActive guard:** Deploy ek active workflow ko update kar sakta hai, par kabhi khud on nahi karta.
- **Live walk script:** Ek script jo poori kahani asli system par chalata hai aur har step ka PASS/FAIL chhapta hai.

Poori entries `concepts.delta.md` mein hain.

## 6. High-Level Flow
Journey: ek guest ka order, concierge se jawab tak.

1. Decide: guard state aur sawaal banata hai (concierge ke liye sheet taiyaar). [VERIFIED code read]
2. Ask Jev: request decisions desk par jaati hai, 900 ms limit, ek retry (200 ms baad). [VERIFIED code read]
3. Result: `answers.rider` padha jaata hai. Status `ok`, low confidence, cost cap, bad reply ya error. Rule ka pick dono haalat mein likha jaata hai. [VERIFIED code read]
4. Health: ek noul (haan/na) sawaal. Jawab mein number aaya to OK, aur ek run row likhi jaati hai. [VERIFIED code read]
5. Deploy: PUT sirf das active workflows par, read-back, koi activate nahi. [VERIFIED]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `ops/n8n/order/code/decide_guard.js` | Guard ki sheet: state aur ek choice sawaal (rider ids + none). +5/-4 |
| `ops/n8n/order/code/decide_result.js` | Jawab padhne wala: `answers.rider` padhta hai, wahi statuses rakhta hai. Reason text nahi. +3/-3 |
| `ops/n8n/order/code/health_prepare.js`, `health_result.js` | Health ka ek noul sawaal; number 0..1 aaye to OK. +4/-5, +2/-3 |
| `ops/n8n/order/build.js` | Dono "Ask Jev" nodes ka address: `/api/alpha/decisions`. +2/-2 |
| `ops/n8n/order/deploy.js` | Crew ka rule: PUT allowed on already-active workflow; kabhi activate nahi. +5/-2 |
| `ops/n8n/order/decide.test.js`, `health.test.js` | Asli shape ke fixtures, endpoint ka assert, naye bad-reply cases. +19/-9, +14/-7 |
| `scripts/live_check.py` (new) | Raat ka manager: dev par ek asli order ka walk, PASS/FAIL. +54 |
| `docs/ai/JEV_D1_D5_CONTRACT.md`, `docs/integrations/n8n-order-workflows.md`, `docs/assumptions.md`, `docs/follow-ups.md`, `docs/tests/test-cases.md`, `docs/discussions/2026-10-14.md` | Docs: contract, activation note, A46–A50 confirmed, F81, 6 live rows, discussion line |

## 8. Pieces aapas mein kaise baat karte hain
```
decide_guard.js (state + ek choice sawaal)
  -> build.js: "Ask Jev" node -> POST /api/alpha/decisions
  -> decide_result.js (answers.rider -> status, rule ka pick likha jaata hai)

health_prepare.js -> "Ask Jev" node (build.js) -> health_result.js (answers.sky.noul)
deploy.js -> PUT on ten workflows -> read-back (koi activate nahi)
live_check.py -> webhook + events + run rows + decision rows (dev par likhta hai)
```
- Health ka chain node naam se judta hai; yeh INFERRED hai, brief mein poora chain nahi tha. [INFERRED]
- `live_check.py` dev par likhta hai aur ek Jev call kharch karta hai; safai `clear_dev.py` se hoti hai. [VERIFIED code read]

## 9. Pehle se kya badla
- +164 / -68 in 17 files. Teen commits: `5ca6417` (Jev endpoint), `c152283` (live rows + live_check.py), `7152fea` (deploy accepts active workflows + Jev live run). [VERIFIED]
- `app/` mein koi file nahi badli. [VERIFIED reviewer]
- Test fixtures ab 15 Oct ke asli jawab copy karte hain: choice confidence 1, probabilities, usage cost 0.00002; noul 0.85, cost 0.00001. [VERIFIED]
- Naye bad-reply cases: `answers: {}`, HTML body, aur noul jawab jahan choice chahiye thi. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Headroom sirf 150 ms.** Decide Jev calls 739 aur 868 ms par chalin, limit 900 ms (ek retry ke saath). Dheemi raat par `jev_error` aata hai aur rule akela chalta hai (safe), par stage par ops line par suggestion nahi dikhega. Impact: demo polish. Check: F81 b, test-cases rows. [VERIFIED rows; INFERRED variance]
2. **"Alpha" endpoint.** `/api/alpha/decisions` shape badle to result code `jev_bad_reply` par girta hai (safe). Impact: advice chup jaati hai. Check: `build.js` line 101; contract Tier A. [VERIFIED]
3. **Das dev workflows active hain**, SUB aur ERR 00 bhi. Public webhook par token aur kill switch hai, rate limit nahi (F65 d). Impact: owner ne 15 Oct ko yeh maana. Check: `verify_live` aaj. [VERIFIED]
4. **21:00 scorecard** test rows ko ginega jab tak `clear_dev.py` na chale. Impact: pehla card shor wala. Check: test-cases "Not yet run live" row. [VERIFIED]
5. **health OK har number 0..1 ko maanta hai,** 0 bhi ("aasmaan neela nahi"). Impact: koi nahi; health sirf dekhta hai Jev bola ya nahi. Check: `health_result.js` line 13. [VERIFIED]
6. **`live_check.py` docstring** mein "/bin/zsh.00002" likha hai; "$0.00002" hona chahiye. Impact: cosmetic. Check: line 3. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Lambi Jev timeout. Kyun: owner ka faisla (F81 b). [VERIFIED brief]
- Ops line par reason text. Kyun: endpoint reason nahi deta (F81 d). [VERIFIED brief]
- Dev test rows abhi saaf nahi. Kyun: pehle 21:00 card. [VERIFIED brief]
- Abhi live nahi chala: 21:00 card, 503 kill switch row, galat Jev naam, 1 ghante ka tab, founder ka Android airplane mode. [VERIFIED test-cases row]

## 12. Testing Story
- Red pehle: 63 mein se 8 node tests fail hue (request body, endpoint URL, reply shape) fix se pehle. [VERIFIED quote, INFERRED run]
- Reviewer ne `7152fea` par node 63/63 chalaya. [VERIFIED]
- Live rows (coder ke, 15 Oct): API walk, fix se pehle Jev FAIL; fix ke baad health Jev OK 748 ms, decide r2 confidence 1 739 ms cost $0.0000215, ops line "AI suggests rider R2 (100%). The rule agrees.", decision time 868 ms. [VERIFIED rows; INFERRED runs]
- Do asli browsers par dev URL: /health Supabase OK 126 ms, n8n OK ~1.0 s; kitchen card doosre device par 0.8 s. [VERIFIED rows; INFERRED runs]
- Reviewer ka verify_live aaj: das dev workflows active=true, parameters same. [VERIFIED]
- Covered nahi: 21:00 card, 503 row, galat Jev naam, 1 ghanta tab, Android airplane mode. [VERIFIED brief]

## 13. Trade-offs & Alternatives

| Chuna | Chhoda | Kyun | Gave up |
|---|---|---|---|
| Typed sawaal with criteria | Chat prompt | Yahi endpoint hai | Free "reason" line |
| Fixtures copied from real answers | Invented fake | Fake ne ek din jhooth bola | Kuch nahi |
| PUT on active workflows | "Inactive on every deploy" | Fix ko bina stop ke live pahunchna hai | Inactive guarantee; wasActive guard owner ka haath switch par rakhta hai |
| Ek live script | Haath se calls | Repeatable, sheet chhapta hai | Dev par likhta hai, clean-up chahiye |

## 14. Patterns is PR se
Brief mein alag patterns ki list nahi thi. Yeh teen patterns brief ke concepts se hain:
- **Fixtures from real answers:** asli jawab ki copy se test. Yahan: `ops/n8n/order/decide.test.js` line 61.
- **wasActive guard:** deploy active ko update kare, on na kare. Yahan: `ops/n8n/order/deploy.js` line 69.
- **Live walk script:** ek script, PASS/FAIL per step. Yahan: `scripts/live_check.py` line 3.

## 15. AI-Review Lens
- **Trust:** endpoint URL (do baar assert), jawab padhne ka code (bad cases test hue), live PASS rows execution ids ke saath, wasActive guard (test mein activate call nahi). [VERIFIED brief]
- **Interrogate:** 900 ms headroom, "alpha" endpoint, aur kaun dev rows kab saaf karega. [VERIFIED brief]
- **PM ka sawaal:** "push kar do" ab live active workflow ko turant badalta hai. Owner ko pata hona chahiye. [VERIFIED brief]

## 16. Questions
- **Top-3 abhi poocho:**
  1. `ops/n8n/order/code/decide_guard.js` line 24: Jev state se padhta hai ya criteria se? Distance aur trips state mein hain.
  2. `ops/n8n/order/deploy.js` line 69: "push kar do" ka matlab ab live par turant hai. Owner ko pata hai?
  3. `docs/integrations/n8n-order-workflows.md` line 109: A46–A50 "Confirmed" sahi hain? Activation order sahi hai?
- **Poora bank:** comment blocks mein 10 sawaal, question order mein (neeche).

## 17. Self-check (light, 2-3)
- Chat line par prompt aur decisions desk par state sheet mein kya farq hai? (Top-1 se judaa.)
- Agar Jev 900 ms se der kare, to ops line par kya dikhega, aur rule ka kya hoga? (Risk se judaa.)
- "push kar do" ke baad live workflow badalne se pehle owner ko kya jaanna chahiye? (Top-2 se judaa.)

---

## Comment blocks (10 posted, review 5526169251, har block mein GitHub id)

<!-- gh-comment-id: 4277468619 --> `ops/n8n/order/code/decide_guard.js:24` · Understanding · **Top-3**
> Pehle chat line par prompt bhejte the; asli call ne bataya Jev sirf decisions desk par sunta hai: `state` + typed `questions`, typed `answers` wapas, koi reason text nahi. Criteria = rider ids + none, instructions ek line. Yahi body asli call mein r2 confidence 1 laayi ($0.00002). Ek sawaal: criteria mein sirf "Rider r1." likha hai; distance/trips state mein hain, to Jev state se padhta hai, criteria se nahi? Theek?
- **Reply (klickbae8yt-star):** Yes. Jev reads the state (distance and trips); the criteria are only the labels of the options. The real call chose r2 from the state.
- **Status:** answered

<!-- gh-comment-id: 4277468629 --> `ops/n8n/order/deploy.js:69` · Risk · **Top-3**
> Pehle read-back par `back.active` = fail. Ab `wasActive` yaad rakhta hai: jo pehle se active tha (owner ne kiya), uspar PUT chal sakta hai; jo khud active ho jaaye, fail. Activate call ab bhi kahin nahi (test). Yaani deploy ab live active workflow ko beech demo mein badal sakta hai: "push kar do" ka matlab ab "live par turant" hai. Owner ko yeh pata ho.
- **Reply (klickbae8yt-star):** Yes, and the owner should know: for an active workflow, a deploy is live at once. "Push kar do" now means live now. I will say so in each handoff and in the n8n doc (next PR).
- **Status:** answered

<!-- gh-comment-id: 4277468636 --> `docs/integrations/n8n-order-workflows.md:109` · Assumptions · **Top-3**
> Activation: is n8n version mein MAIN tab tak publish nahi hota jab tak uske SUB publish na hon, to "activate" = dason, SUB pehle. Reviewer ka pehla kehna ("SUB active nahi chahiye", INFERRED) galat tha; sabak likh liya. Aaj verify_live: dason active=true, parameters=same. Owner: A46–A50 "Confirmed 15 Oct" sahi?
- **Reply (klickbae8yt-star):** Yes. The owner said "haan" to A46 to A50 on 15 Oct (through the handoff), so they are marked Confirmed.
- **Status:** answered

<!-- gh-comment-id: 4277468641 --> `ops/n8n/order/build.js:101` · Risk
> 900 ms timeout + ek retry (200 ms baad). Live: decide 739 aur 868 ms, yaani ~150 ms bacha. Dheemi raat = `jev_error` = rule akela (safe), par stage par ops line "no suggestion" dikhegi. Owner chune: 900 rakhna ya 1500 (F81 b). Endpoint "alpha" hai: shape badle to `jev_bad_reply`, safe.
- **Reply (klickbae8yt-star):** The owner picks: keep 900 ms or raise to 1500 ms (F81 b). If Jev is slow, the rule decides alone and the row says `jev_error`, which is safe. It is an alpha endpoint; a changed shape becomes `jev_bad_reply`, also safe.
- **Status:** answered

<!-- gh-comment-id: 4277468650 --> `ops/n8n/order/code/decide_result.js:12` · Understanding
> Reply tab hi ginta hai jab `answers.rider.type === 'choice'`, choice options mein ho, confidence 0..1 number ho; phir wahi statuses (cost_cap, low confidence < 0.70, ok). `reason` gaya: ops line ab bina wajah (F81 d). Confidence 1 aur probabilities r2: 1 — Jev yahan bahut sure hai; rule bhi r2. Theek.
- **Reply (klickbae8yt-star):** Thanks. Without the `reason` text the ops line has no reason (F81 d).
- **Status:** answered

<!-- gh-comment-id: 4277468657 --> `ops/n8n/order/code/health_result.js:13` · Understanding
> Health "ok" = `answers.sky.noul` 0..1 ka number aaya, chahe 0 ho ("aasmaan neela nahi"). Yahi sahi hai: health poochta hai Jev bola ya nahi, kya bola nahi. Theek?
- **Reply (klickbae8yt-star):** Yes. Health asks if Jev answered, not what it said.
- **Status:** answered

<!-- gh-comment-id: 4277468661 --> `ops/n8n/order/decide.test.js:61` · Testing
> Fixture ab asli jawab ki copy hai (id, provider, answers, usage cost 0.00002). Pehla fake chat shape ka tha aur galat endpoint ko ek din chhupa gaya. Sabak: fake asli reply se banao, ya ek baar asli call karke shape pin karo. Naye bad cases (khali answers, HTML, noul jahan choice chahiye) achhe.
- **Reply (klickbae8yt-star):** Agreed. The lesson is in LEARNINGS: take the fixture from a real answer.
- **Status:** answered

<!-- gh-comment-id: 4277468670 --> `scripts/live_check.py:3` · Ops
> Docstring mein "/bin/zsh.00002": file likhte waqt shell ne `$0` expand kar diya; "$0.00002" hona chahiye, ek shabd. Script dev par LIKHTI hai (anonymous user, order, events, decision, run rows) aur ek Jev call kharch karti hai; clean-up `clear_dev.py`, par 21:00 card ke baad (F78 c). `User-Agent: curl/8.7.1` yahan bhi.
- **Reply (klickbae8yt-star):** A real mistake: the shell turned `$0.00002` into `/bin/zsh.00002` when the file was written. I fix it in the next PR. The script writes to goserve-dev and spends about $0.00002 on one Jev call; `clear_dev.py` cleans up after the 21:00 card.
- **Status:** answered

<!-- gh-comment-id: 4277468679 --> `docs/tests/test-cases.md:138` · Docs
> Fix ke baad live: health Jev OK 748 ms, decide r2 confidence 1 739 ms $0.0000215, ops "AI suggests rider R2 (100%). The rule agrees.", decision time 868 ms. Kitchen card doosre device par 0.8 s. Yeh 18 Oct ke liye asli sabut hai. Baaki pending: 21:00 card, 503 row, galat Jev naam, 1 ghante ka tab, Android airplane (#56).
- **Reply (klickbae8yt-star):** Agreed. The pending live rows are the 21:00 card, the 503 row, a wrong Jev name, a tab open for 1 hour and the Android airplane check (#56).
- **Status:** answered

<!-- gh-comment-id: 4277468686 --> `docs/ai/JEV_D1_D5_CONTRACT.md:22` · Docs
> Contract ab decisions endpoint kehta hai, Tier A (OpenRouter ka Jev tutorial) + asli call se confirm. F81 c: global model notes (`~/.claude/CLAUDE.md` section 15 "Decision API") bhi "chat completions" nahi kehte par endpoint nahi batate; owner ek line jod sakta hai. Temperature/max_tokens rows hat gayi — sahi, endpoint par nahi hain.
- **Reply (klickbae8yt-star):** Agreed. The contract is corrected. The owner can add the endpoint to the global model notes (F81 c).
- **Status:** answered

---

## 18. Handoff

State: 0 answered · 10 open · actor: coder (threads), then owner (merge)

Owner lines (Romanized Hindi):
```
PR #81 approve ho chuka hai. Merge karo (feat/46-jev-decisions-endpoint -> dev).
Decide karo: Jev ka 900 ms limit rakhna hai ya 1500 ms karna hai. Yaad rakho ki "push kar do" ab live active workflows ko turant badalta hai.
A46–A50 "Confirmed" mark sahi hain, aur aaj raat ka 21:00 card test rows ginega.
```

Coder paste-block (English):
```
PR #81 APPROVED (review 5526169251, 10 threads). Owner merges.

1. Reply on each thread by id.
2. One-word fix in scripts/live_check.py docstring: "/bin/zsh.00002" -> "$0.00002".
3. After merge, copy the bundle and rows.
4. Next: #56 live runs (critical path). #82 and #85 wait for the owner.
```

posted as satvik-jain-iitd, review 5526169251, 10 inline threads
