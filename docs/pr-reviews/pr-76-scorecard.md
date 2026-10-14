# PR #76 — feat(ops): daily scorecard workflow with Telegram message

- **Branch:** `feat/47-scorecard` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #47 "Daily scorecard workflow (MAIN 90)" (epic #35)
- **Status:** MERGED into dev `f4aad24` on 14 Oct 2026 17:49Z (APPROVE review 5522030028, head `76ed3bb`, CI green); 17 threads answered and resolved [VERIFIED]
- **Files:** 25 · **Lines:** +988 / -58 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5522030028 (APPROVE), 17 inline threads
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/76

> Ek hotel ka raat ka auditor: 21:00 par ledger padhta hai, ek slip likhta hai, aur owner ke darwaze ke neeche sarka deta hai. Yeh PR wahi auditor banati hai.

---

## Overall review

## 1. Ek-line logline
> `Scorecard PR: MAIN 90 roz raat 21:00 India time par aaj ki runs aur decisions ko ek plain Telegram message mein bhejta hai, numbers ke saath.`

## 2. Big Picture (Story & Goal)
- Story #47 "Daily scorecard workflow (MAIN 90)", epic #35. Yeh Build design §6 aur rulebook B13.3 se judi hai. [VERIFIED brief]
- S1 (Gherkin): "Given run_log and decision_log rows for today, When the schedule fires, Then the owner gets one Telegram message with runs, errors and cost." MAIN 90 21:00 India time par chalta hai, SUB 91 aaj ki rows padhta hai, aur ek plain message jaata hai. [VERIFIED brief]
- Story se zyada: time pair, decision pair, health split, truncation note, failed-read message, kill switch. [VERIFIED brief]
- Chart nahi, dashboard nahi. Ponytail note story mein hai. [VERIFIED brief]
- Missing: live row abhi nahi. Woh "push kar do" aur "activate" ke baad aayegi (F78 a). [VERIFIED brief]

## 3. Yeh ab aaya kyun? (Context)
- Pichla PR #75 merge ho chuka hai (`35f78cd`). Uske 20 threads answered aur resolved hain. [VERIFIED brief]
- Is PR ke commit `933212d` mein #75 ke do should-fix items aaye: autopilot loop refusal par ruke, aur demo mein `useOps` band ho. [VERIFIED brief]
- Is PR mein teen commits hain: `e93b3ec` (docs, notebook chapter 16 aur rows), `933212d` (fix app), `76ed3bb` (feat ops, scorecard). [VERIFIED brief]
- build.js pehle aath workflows deta tha. Ab SUB 91 aur MAIN 90 unke saath jude hain. [VERIFIED brief]

## 4. Real-Life Analogy
Hotel ki raat ki shift. Ek auditor raat ko din ka hisaab banata hai.

1. MAIN 90 = raat ka auditor: 21:00 sharp ledger dekhta hai, ek slip likhta hai, aur owner ke darwaze ke neeche sarkata hai.
2. SUB 91 = ledger clerk: sirf aaj ke pages padhta hai (runs aur decisions), ginta hai, tally haath mein deta hai. Pen ko chhota nahi chhoota.
3. score_window.js = auditor ki deewar ghadi, India time par set: "aaj" India ki raat 12 baje shuru hota hai, Greenwich par nahi.
4. score_summary.js = tally sheet: kitne guest ne seva li, kitni shikayat, average aur sabse dheemi seva, concierge se salah kitni baar mangi gayi aur kitni baar maani gayi, bill cost per salah ke saath. Lobby ke apne health rounds alag line par.
5. score_message.js = slip: chhe chhoti lines, saadi siyahi, koi formatting nahi jo toot sake.
6. Kill switch = "aaj slip nahi" ka board, auditor ki mez par.
7. ERR 00 = raat ki ghanti, agar auditor seedhiyon par gir jaaye.
8. Config chat_id = owner ka room number. Deploy ke waqt safe se likha jaata hai, manual mein kabhi print nahi hota.
9. #75 ke fixes = drill card par do sudhaar: desk mana kare to drill ruke; cardboard guest concierge ko kabhi na ghante.

## 5. Is PR mein naye Concepts (6)
Poori list `concepts.delta.md` mein hai: Schedule trigger + workflow timezone · Day window in UTC · Metric pairs (B13.3) · Read-only SUB with a caller list · neverError + fullResponse · Truncation flag. [VERIFIED brief]

## 6. High-Level Flow
Journey: auditor ka raat ka route, ek slip owner tak.

1. 21:00 India time par schedule trigger MAIN 90 chalata hai. Workflow timezone Asia/Kolkata hai. [VERIFIED brief]
2. Config: kill_switch false, chat_id (vault se), supabase_url. Kill switch on ho to Paused, kuch nahi bheja jaata. [VERIFIED brief]
3. Prepare window: `since` = aaj 00:00 India time, UTC mein. `date` = aaj ki India date. [VERIFIED brief]
4. SUB 91 ko `since` aur `supabase_url` diye jaate hain. SUB 91 service-role credential se run_log aur decision_log dono se aaj ki rows GET karta hai (dono ki limit 1000). Koi write nahi. [VERIFIED brief]
5. Summarise: ginti, pairs, health alag, truncation flag. Read ka status 200 nahi ho to ok:false aur 502. [VERIFIED brief]
6. Format message: chhe lines, ya "No runs today.", ya "could not read". Send scorecard: ek Telegram message chat_id par, GoServeBot credential se. [VERIFIED brief]
7. Koi node throw kare to ERR 00 alert bhejta hai. [VERIFIED brief]

## 7. The Cast (Files ka role)
| File | Role |
|---|---|
| `ops/n8n/order/build.js` | Auditor ka rota aur clerk ka form: SUB 91 aur MAIN 90 ke nodes, schedule 21:00, timezone Asia/Kolkata, Telegram node. +49/-1 |
| `ops/n8n/order/code/score_window.js` (new) | Deewar ghadi: aaj ki shuruaat India time par, UTC mein. +7 |
| `ops/n8n/order/code/score_summary.js` (new) | Tally sheet: ginti, pairs, health alag, truncation. +20 |
| `ops/n8n/order/code/score_message.js` (new) | Slip: chhe lines, khaali din, failed read aur cut page ka note. +18 |
| `ops/n8n/order/deploy.js` | Deploy ki list: ten workflows, SUB pehle, MAIN 90 aakhir mein. +5/-5 |
| `ops/n8n/order/order.test.js` | Deploy test ab ten naam expect karta hai. +3/-3 |
| `ops/n8n/order/scorecard.test.js` (new) | 12 tests: window, numbers, khaali aur cut din, failed read, message, MAIN 90 wiring, Telegram node, SUB 91 read-only aur caller, koi secret nahi, canvas layout. +127 |
| `app/src/App.tsx` | #75 ke do fixes: loop non-network code par ruke; demo mein `useOps` band. +2/-1 |
| `app/tests/e2e/autopilot.spec.ts` | S1 mein order-list read nahi; naya 503 spec; naya offline-decide spec. +26 |
| `app/tests/unit/autopilot.test.ts` | Step time exactly 2000 assert. +2/-2 |
| `docs/assumptions.md`, `docs/follow-ups.md`, `docs/integrations/n8n-order-workflows.md`, `docs/tests/test-cases.md` | A49 reword, A50 naya, F77 f–g, F78 a–e, n8n doc rows aur "Daily scorecard" section, 4 test rows. Docs only. |
| `docs/pr-reviews/*`, `docs/process-trace.md`, `docs/LEARNINGS.md`, `docs/discussions/2026-10-14.md` | Reviewer ka notebook aur rows, coder ne copy kiye. Is baar dobara review nahi hua. |

## 8. Pieces aapas mein kaise baat karte hain
```
MAIN 90 (auditor, schedule 21:00 IST)
  -> Config -> Kill switch? -> Prepare window (score_window.js)
  -> Call SUB 91 (clerk)
       SUB 91: GET run_log, GET decision_log (read only, service role)
       SUB 91 -> Summarise (score_summary.js)
  -> Format message (score_message.js) -> Send scorecard (Telegram)
  -> errorWorkflow: ERR 00 (raat ki ghanti)

deploy.js -> build.js (dono workflows banata hai)
scorecard.test.js -> Code nodes ka asli file text chalata hai
```
- SUB 91 ka callerPolicy sirf MAIN 90 ko allow karta hai. [VERIFIED brief]
- Code nodes `$('Config')` aur `$('Prepare window')` naam se padhte hain. [VERIFIED brief]

## 9. Pehle se kya badla
- +988 / -58 in 25 files. Teen commits: `e93b3ec`, `933212d`, `76ed3bb`. [VERIFIED brief]
- Naye: SUB 91 aur MAIN 90 (build.js mein), teen Code nodes, scorecard.test.js. [VERIFIED brief]
- 14 of 25 files reviewer ka notebook hain (chapters 15 aur 16, journals, README) aur trace/LEARNINGS rows. Bundle se match karti hain, sirf reviewer ke baad ke edits alag hain (PR #75 merged, replies folded). [VERIFIED diff -r]
- Deploy dry run (read-only) par: SUB 16, SUB 91 aur MAIN 90 = create; ERR 00, SUB 11–15, MAIN 01 = update. Dono credentials mile. Kuch active nahi, kuch deploy nahi. [VERIFIED]

## 10. Macro Risks & Downstream Impact
1. **Shaam ki rows kisi card mein nahi.** Window 00:00 India se shuru hota hai, card 21:00 par jaata hai. 21:00 se raat 12 tak ki rows na aaj ke card mein, na kal ke (kal ka window phir 00:00 se). Impact: 18 Oct ki shaam ka demo 21:00 ke baad ho to kisi card mein nahi aayega. Check: score_window.js line 6, cron 21:00. [VERIFIED code read]
2. **Runs aur Cost alag set par.** `cost` health checks bhi jodta hai; `runs` health ko alag rakhta hai. `decide_cost / decisions` run_log ke decide cost ko decision_log ki row count se bhaagta hai. Fail hua decide run (row nahi likhi) bhi cost mein jaata hai. Impact: cents ka farq; health checks zyada hon to confusing (F76 e). Check: score_summary.js lines 9–18. [VERIFIED]
3. **Poore system ki rows.** SUB 91 service role se padhta hai (RLS bypass), sirf created_at par filter karta hai. Test runs aur clear_dev ke bache rows bhi card mein aayenge. Impact: by design (A50); F78 c. Check: build.js line 247, A50. [VERIFIED]
4. **Do Telegram raaste.** Failed read par "could not read" (plain message). Node throw par ERR 00 ka alert. HTTP node ka 10 s timeout shayad neverError ke bawajood throw kare. Impact: kuch khota nahi, par owner ko pata ho ki kaunsa message kya kehta hai. [VERIFIED wiring; INFERRED timeout behaviour]
5. **Node ke naam se padhna.** Agar build.js mein `Prepare window` ya `Config` ka naam badle to unit test pass ho jaata hai (stub `{}` deta hai), aur live par date ya chat_id khali. Naam aaj match karte hain. Check: scorecard.test.js line 14, build.js lines 267, 273. [VERIFIED]
6. **Ek "push kar do" se teen naye aur saat update.** SUB 16, SUB 91, MAIN 90 naye; saat update. MAIN 90 "activate" ke bina inactive rehta hai, aur activate ka matlab schedule chalu (rulebook 8). Impact: owner ke shabd ke bina kuch nahi. [VERIFIED dry run]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Charts aur dashboards. Kyun: story ka ponytail note. [VERIFIED brief]
- Targets aur thresholds. Kyun: A50 sirf numbers kehta hai; B13.4 proposals MVP 1 mein hain (F78 d). [VERIFIED brief]
- 1000 se aage paging. Kyun: demo ke liye kaafi hai; count query baad mein (F78 e). [VERIFIED brief]
- Prod ki copy of SUB 91 aur MAIN 90. Kyun: credential sirf dev ka hai (F78 b). [VERIFIED brief]
- Per-session scorecard. Kyun: owner ka card poore system ke liye hai (A50). [VERIFIED brief]

## 12. Testing Story
- Red pehle: PR body quote karti hai. scorecard.test.js ke 12 tests mein 11 fail hue ("Cannot find module" Code nodes ke liye, aur build mein `main90` nahi tha). Do app specs bhi pehle fail hue. [VERIFIED quote, INFERRED run]
- Reviewer ne `76ed3bb` par dobara chalaya: node 62/62 (`ops/n8n/order/*.test.js`), tsc clean, vitest 79/79, playwright 50/50 (test build `VITE_AUTOPILOT_MS=300`). [VERIFIED]
- Code nodes asli file ke text se `new Function` ke through chalte hain, order.test.js wala tareeka. Jo n8n mein chalega wahi test hota hai. [VERIFIED]
- Tests ki ginti: node 12 naye (scorecard.test.js) aur 1 badla (order.test.js deploy order); e2e 2 naye aur 1 badhaya; unit 1 tight kiya. [VERIFIED]
- Manual: do SUB 91 read URLs goserve-dev par service key se 200 aaye (0 rows, dev saaf). [VERIFIED claim in PR body, INFERRED run]
- Test-cases: 4 rows (2 pass, 1 manual read pass with 0 rows, 1 live pending activation). [VERIFIED brief]
- Covered nahi: 21:00 ka asli fire aur Telegram delivery (live row, activate ke baad, F78 a). Live instance par timezone setting. Node naam ka rename. [VERIFIED brief]

## 13. Trade-offs & Alternatives
| Chuna | Chhoda | Kyun | Gave up |
|---|---|---|---|
| UTC arithmetic "midnight India" ke liye | Timezone library | Saat lines, koi dependency nahi; India mein daylight saving nahi | Aaj kuch nahi; doosra timezone aaye to rewrite |
| Plain-text Telegram (no parse_mode) | HTML jaisa ERR 00 | Escape ki zaroorat nahi, kuch nahi tootega | Bold headings |
| Ek message, chhe lines | Dashboard | Ponytail, B13.3 pairs | Din ke trends (B13.4, MVP 1) |
| `limit=1000` + truncated flag | Paging | Demo ke liye kaafi | 1000 se zyada din par exact count |
| Window midnight se | Rolling 24 h | "Aaj" padhna asaan | 21:00–24:00 ki rows (should-fix) |

## 14. Patterns is PR se
- **Metric pairs:** har number apne check ke saath: runs errors ke saath, avg max ke saath, decisions agreement ke saath, cost per decision ke saath. Ek number akela achha dikh kar dhokha nahi de sakta. (tally sheet) — `score_message.js`.
- **Read-only SUB with caller list:** sirf GET, aur callerPolicy sirf MAIN 90. Likhne ki capability hi nahi, design se. (clerk ke paas pen nahi) — `build.js` SUB 91.
- **neverError + fullResponse:** HTTP node status aur body data ki tarah deta hai; Code node tay karta hai 500 ka matlab kya hai. (clerk ka form) — `build.js` SUB 91 read nodes.
- **Truncation flag:** 1000 rows mile to "shayad aur bhi hain" likho, poora count mat maano. (sheet ki aakhri line) — `score_summary.js`.
- **Day window arithmetic:** India ka "aaj" = shift, round, shift wapas. (auditor ki ghadi) — `score_window.js`.
- **Shell first deploy:** deploy.js pehle khaali shells banata hai, taaki `ids.main90` content banne se pehle mile. (kamre ka number pehle, saamaan baad mein) — `deploy.js`.

## 15. AI-Review Lens
- **Trust:** wiring (har node aur edge assert), SUB 91 read-only (sirf GET, caller list), koi secret build mein nahi (assert), message ka text (assert), #75 ke do fixes (do specs). [VERIFIED brief]
- **Interrogate:** 21:00 se raat tak ka gap; "Cost" mein zyada rows kyon; live instance par timezone cron ko kaise chalata hai; kaunsa Telegram message "read failed" hai aur kaunsa "workflow crash"; "Runs" aur "Cost" ka set alag kyon hai. [VERIFIED brief]

## 16. Questions
- **Top-3 abhi poocho:**
  1. `ops/n8n/order/code/score_window.js` line 6: 21:00 ke baad ki rows ka gap.
  2. `ops/n8n/order/code/score_summary.js` line 18: Runs aur Cost ka alag set.
  3. `docs/assumptions.md` line 60: A50 par owner ki haan ya na.
- **Poora bank:** comment blocks mein 17 sawaal, question order mein (neeche).

## 17. Self-check (light, 2-3)
- Raat 21:00 ke baad ka demo kis card mein dikhega? (Abhi kisi mein nahi: TOP-1.)
- Ek slip par "Runs: 4" aur "Cost" ek hi set ki cheez hai? (Nahi: TOP-2.)
- "could not read" aur ERR 00 alert mein owner ko kya farq pata hona chahiye? (Risk 4.)

---

## Comment blocks (17 posted, review 5522030028, har block mein GitHub id)

<!-- gh-comment-id: 4274148626 --> `ops/n8n/order/code/score_window.js:6` · Risk · **Top-3**
> Window aaj 00:00 India se shuru, card 21:00 par jaata hai: 21:00 se raat 12 baje tak ki rows kisi card mein nahi aati (kal ka window phir 00:00 se). 18 Oct ki shaam ka demo 21:00 ke baad hua to scorecard mein nahi dikhega. Ek line: `since = now − 24 h` aur head "last 24 hours", ya cron `55 23 * * *`. Owner chune. Is PR mein ya agle mein.
- **Reply (klickbae8yt-star):** Agreed, this is the main gap. The owner has to pick: a rolling 24 hours headed "last 24 hours", or cron 55 23. I logged it as F79 (a) until it lands.
- **Status:** answered

<!-- gh-comment-id: 4274148634 --> `ops/n8n/order/code/score_summary.js:18` · Risk · **Top-3**
> `cost: sum(runsRes.body)` sab rows jodta hai, health checks bhi; par `runs` health ko alag rakhta hai. Ek hi slip par "Runs: 4" aur "Cost" 5 calls ka. Aur `decide_cost / decisions`: run_log ke decide runs ka cost, decision_log ki rows se bhaag; fail hua decide run (row nahi likhi) bhi cost jodta hai. Pair ek hi set par ho: cost bhi non-health rows ka, ya label "all calls incl. health"?
- **Reply (klickbae8yt-star):** Fair point. The cost line now says "Cost of all calls" (health included), and the per-decision figure uses the decide runs only. The doc says so. A decide run that failed before its row still adds cost: F79 (d).
- **Status:** answered

<!-- gh-comment-id: 4274148640 --> `docs/assumptions.md:60` · Assumptions · **Top-3**
> A50: ek plain Telegram message 21:00 India time par; pure system ki aaj ki rows (ek session nahi); pairs: runs+errors, time avg+max, decisions+Jev used+agreed, cost+per decision; health alag; 1000 se zyada ho to note; read fail ho to message; sirf numbers, target nahi; sirf goserve-dev. Owner se haan ya na. Ek baat: test runs aur clear_dev se bachi rows bhi card mein aayengi (F78 c).
- **Reply (klickbae8yt-star):** This needs the owner's own yes, apart from the merge. A50 stays Open until then. Test rows show in the card until `clear_dev.py` runs (F78 c).
- **Status:** answered

<!-- gh-comment-id: 4274148647 --> `ops/n8n/order/build.js:266` · Understanding
> Cron `0 21 * * *` ka apna timezone nahi hota; workflow setting `timezone: Asia/Kolkata` (line 290) tay karta hai ki kaunsa 21:00. Test setting check karta hai; live instance par yeh setting cron ko chalati hai ya instance ka default — yeh live row (F78 a) se hi pakka hoga: pehla message 21:00 IST par aaya ya nahi.
- **Reply (klickbae8yt-star):** Right. Only the first live message proves it: did it come at 21:00 India time? F79 (f) says so, and the test-cases row asks for the execution id.
- **Status:** answered

<!-- gh-comment-id: 4274148652 --> `ops/n8n/order/build.js:262` · Security
> SUB 91 `callerPolicy: workflowsFromAList` sirf MAIN 90 ke liye, aur credential service-role (RLS bypass) se sirf GET. Pehli `--apply` par `ids.main90` tab hoga jab shells pehle ban jaayein (deploy.js line 58): dry run mein "create" dikhta hai, to apply do step mein — shell, phir content. Sahi padha?
- **Reply (klickbae8yt-star):** Yes. `--apply` makes empty shells for every missing workflow first, so `ids.main90` exists, then puts the content in. The dry run only says "create".
- **Status:** answered

<!-- gh-comment-id: 4274148659 --> `ops/n8n/order/build.js:247` · Risk
> Read URL mein `limit=1000` par `order=` nahi: 1000 se zyada rows par PostgREST kaunsi 1000 dega, tay nahi; `truncated` flag owner ko bata deta hai. `since` ISO (Z) URL mein seedha jaata hai, `:` aur `.` theek; agar kabhi `+05:30` format aaya to `+` toot jaayega. Abhi theek.
- **Reply (klickbae8yt-star):** Done. The read now has `order=created_at.desc`, so a full page is the newest 1000 rows. The `since` value is always UTC with Z, so the plus sign is not a risk.
- **Status:** answered

<!-- gh-comment-id: 4274148669 --> `ops/n8n/order/build.js:249` · Understanding
> `neverError: true` + `fullResponse`: Supabase ka 500 item ban kar aata hai, Summarise 502 lautata hai, owner ko "could not read" message. Par 10 s timeout shayad phir bhi throw kare, tab ERR 00 ka alert jaata hai. Do alag Telegram message, do alag matlab: "could not read" = DB ne mana kiya; ERR 00 alert = workflow gira. Owner ko yeh fark pata ho.
- **Reply (klickbae8yt-star):** Yes. I added both messages to the integration doc: "could not read" means the database refused; a message from GS ERR 00 means the workflow itself fell over.
- **Status:** answered

<!-- gh-comment-id: 4274148688 --> `ops/n8n/order/build.js:276` · Trade-off
> Telegram node plain text (parse_mode nahi, attribution off): ERR 00 HTML escape karta hai, yahan escape ki zaroorat nahi, kuch tootega nahi. `chat_id` Config mein deploy ke waqt vault se (wahi key jo ERR 00 use karta hai); test "42" check karta hai aur build mein koi token ya project ref nahi. Theek.
- **Reply (klickbae8yt-star):** Thanks. Plain text, so nothing needs escaping.
- **Status:** answered

<!-- gh-comment-id: 4274148693 --> `ops/n8n/order/build.js:290` · Ops
> `settings` ke saath `timezone` jodta hai; `errorWorkflow` ERR 00 wahi rehta hai (test line 91). Yaani MAIN 90 girne par bhi owner ko pata chalega. Ek sawaal: MAIN 90 ki apni run_log row nahi likhi jaati (B13.2 "every run writes a run log row") — scorecard khud ko nahi ginta. Jaan-boojh kar?
- **Reply (klickbae8yt-star):** It is a decision for the owner. MAIN 90 writes no run row, because that row would show in the next card. B13.2 asks for one, so I logged it as F79 (b).
- **Status:** answered

<!-- gh-comment-id: 4274148699 --> `ops/n8n/order/code/score_summary.js:10` · Understanding
> `endsWith(': health')` log_run.js ke label `'GS MAIN 01 Order API: ' + action` par tika hai (F76 f ka filter yahi hai). Koi naya MAIN alag label likhe to uski health rows runs mein gin jaayengi. Aur `jev_used` sirf `jev_status === 'ok'`: `cost_cap` aur `jev_low_confidence` wali rows mein Jev ne jawab diya par "used" nahi gina. Yahi matlab hai "advice used" ka?
- **Reply (klickbae8yt-star):** The filter depends on the `...: health` label (F79 e). "Used" means `jev_status` is `ok`: in shape, at 0.70 or more, under the cost cap. A low-confidence or over-cap answer was asked for but not used. The doc says this now (F79 c).
- **Status:** answered

<!-- gh-comment-id: 4274148707 --> `ops/n8n/order/code/score_message.js:11` · Understanding
> Pairs (B13.3): runs↔errors, avg↔max, decisions↔agreed, cost↔per decision. Har pair ek number ko akela achha dikhne se rokta hai. Owner: pehla set yahi theek hai, target baad mein (A50)? "No runs today." par bhi Decisions/Cost/Health lines aati hain — chhota slip, theek.
- **Reply (klickbae8yt-star):** Agreed: the first set is these four pairs, and targets come later (A50). The extra lines on an empty day are small.
- **Status:** answered

<!-- gh-comment-id: 4274148719 --> `ops/n8n/order/deploy.js:4` · Ops
> ORDER mein SUB 91 MAIN 01 se pehle, MAIN 90 sabse aakhir (B11: SUB pehle, MAIN baad). Dry run abhi: SUB 16, SUB 91, MAIN 90 create; baaki saat update; kuch active nahi. Yaani ek "push kar do" health aur scorecard dono ek saath utaarega. Owner ko yeh ek shabd mein do cheezein pata ho. MAIN 90 activate = schedule, alag "activate" (rulebook 8).
- **Reply (klickbae8yt-star):** Yes. One "push kar do" deploys SUB 16 and SUB 91 (new), MAIN 90 (new) and updates MAIN 01. MAIN 90 has a schedule, so it needs its own "activate". I told the owner in the PR body and in chat.
- **Status:** answered

<!-- gh-comment-id: 4274148727 --> `ops/n8n/order/scorecard.test.js:14` · Testing
> `run` helper Code node ko file ke asli text se chalata hai (`new Function`), order.test.js wala hi tareeka: jo n8n mein chalega wahi test hua. Par `$('name')` anjaan naam par `{}` deta hai: build.js mein `Prepare window` ya `Config` ka naam badle to unit test pass, live par date/chat_id khali. Wiring test naam check karta hai (line 80–92), to abhi pakda jaayega. Sahi?
- **Reply (klickbae8yt-star):** Yes. The wiring test pins `Config` and `Prepare window` by name, so a rename fails a test, not only the live run.
- **Status:** answered

<!-- gh-comment-id: 4274148733 --> `app/src/App.tsx:136` · Understanding
> `else if (code) return void setAuto(false)`: `act` success par null, PlaceError par code, aur kisi error par "unknown" deta hai; `already_done` event par null (success). To network ke alawa har mana karne par loop rukta hai, timer dobara set nahi hota, aur `live.setError` ka alert screen par rehta hai; `setAuto(false)` se effect cleanup (`alive = false`) chalta hai (deps `[auto]`, line 144). #75 thread 4272485326 band.
- **Reply (klickbae8yt-star):** Confirmed. It was right, but one thing was missing: the reason was not visible on the customer tab. The new assert found it, and the reason now shows under the Autopilot button.
- **Status:** answered

<!-- gh-comment-id: 4274148753 --> `app/tests/e2e/autopilot.spec.ts:106` · Testing
> 503 spec: ek call, 1.2 s (chaar step) baad bhi ek, button `aria-pressed` false. Par "reason stays on screen" assert nahi hai: ek line `expect(page.getByText("Orders are paused…")).toBeVisible()` jodo to PR body ka daava bhi test mein aa jaaye. Offline-decide spec (line 115) `page.on("request")` abort hui request bhi pakadta hai — achha.
- **Reply (klickbae8yt-star):** Done, and it found a real gap: the text was not visible on the customer tab. The reason now shows under the Autopilot button. The spec was red first.
- **Status:** answered

<!-- gh-comment-id: 4274148760 --> `docs/follow-ups.md:85` · Docs
> F78: (a) push + activate + pehla live message ya editor mein Execute workflow ek baar (yeh bhi asli Telegram bhejega); (b) prod ke liye apna credential, URL aur copy; (c) test rows card mein dikhengi jab tak clear_dev na chale; (d) B13.4 weekly proposal MVP 1; (e) 1000 cap. Ek row jodo: 21:00 ke baad ki rows ka gap (TOP-1), jab tak fix na ho.
- **Reply (klickbae8yt-star):** Done. F79 (a) is the 21:00-to-midnight gap, with the owner's choice.
- **Status:** answered

<!-- gh-comment-id: 4274148769 --> `docs/tests/test-cases.md:123` · Docs
> Live row "Pending activation": pehla message 21:00 par ya Execute workflow se. Jab chale, row mein likho: execution id, bheja gaya text, aur kya numbers dev rows se mile (SQL count se milaao). Timezone ka sabse bada sabut yahi row hai (sawaal 4).
- **Reply (klickbae8yt-star):** Agreed. The live row will hold the execution id, the sent text and the SQL count of the dev rows.
- **Status:** answered

---

## 18. Handoff

Owner lines (Romanized Hindi):
```
PR #76 approve ho chuka hai. Merge karo (feat/47-scorecard -> dev). A50 par haan ya na do, aur window ka fix chuno: rolling 24 h ya cron 23:55. A46, A47, A48, A49 bhi khule hain.
"push kar do" ab teen naye workflows (SUB 16, SUB 91, MAIN 90) aur saat update utaarega, phir bhi inactive. "activate" alag shabd hai: MAIN 90 activate = schedule chalu.
```

Coder paste-block (English):
```
PR #76 APPROVED (review 5522030028, 17 threads). Owner merges.

1. Reply on each thread (by id).
2. Should-fix, this PR or the next: rows between 21:00 and midnight India time reach no scorecard (score_window.js line 6). Owner picks: rolling 24 h window headed "last 24 hours", or cron 23:55. Add an F78 row until it lands.
3. In the 503 spec, assert the refusal text stays on screen.
4. Deploy nothing until "push kar do"; activate nothing until "activate". If activated, switch to #56.
5. After "notebook filed", copy the review bundle and append the rows files on your next branch.
6. Continue development: story #42 prod deploy on `feat/42-prod-deploy` from `dev`. Open the PR, then say "review NN".
```

posted as satvik-jain-iitd, review 5522030028, 17 inline threads
