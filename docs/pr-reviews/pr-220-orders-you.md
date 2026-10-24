# PR #220 — feat(app): Ink v3 Your orders and You screens (#193)

- **Branch:** `feat/193-customer-account` → `dev`
- **Author:** klickbae8yt-star
- **Story / issue:** #193 "H10 UI rollout: customer" (epic E18, #182)
- **Status:** MERGED `25efc9e`, approved (review 5638912878, APPROVE). Waiting for the owner's merge. [VERIFIED]
- **Files:** 30 (12 are png shots) · **Lines:** +334 / -60 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5638912878 (APPROVE) [VERIFIED]
- **Head:** bf73554 [VERIFIED]
- **CI:** Guard pass, App pass, Site pass. First run failed on a 74-char subject; reworded in a696647. [VERIFIED]
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/220

> Dhaba ke counter par ab do naye board lagte hain: "Your orders" (slips ki list) aur "You" (regular ka card). Har slip par ab "No. 1042" likha hai, aur status customer ki bhasha mein bolta hai.

---

## Overall review

## 1. Ek-line logline
> `Customer app mein do naye counter aaye: "Your orders" aur "You". Slip par short number aur customer ki bhasha aayi. Prod par migrations 0022 se 0026 lag gaye.`

## 2. Big Picture (Story & Goal)
- Yeh PR story #193 "H10 UI rollout: customer" ka kaam hai. Epic E18 (#182) ka hissa hai. [VERIFIED]
- Customer ke liye: pehle order dekhna, purane slip khol kar dekhna, apni details badalna, aur theme chunna. [VERIFIED brief]
- Story #193 maangti hai: customer app naye skill se bane, test ids same rahen, benchmark table pass ho. [VERIFIED brief]
- Test ids same rakhe gaye hain. Benchmark table PR body mein nahi likhi hai. [VERIFIED diff; INFERRED benchmark]

## 3. Yeh ab aaya kyun? (Context)
- Pehle customer ke paas "My orders" ki list nahi thi, aur account screen ka kaam adhoora tha. [INFERRED from brief scope]
- Is PR se do counter khulte hain: "Your orders" aur "You". Dono customer ke phone par naye look mein aate hain. [VERIFIED]
- Prod par migrations 0022 se 0026 aaj lag gaye. Owner ne Tau Ka Dhaba pin 110016 ke liye yes diya. Coder ne output PR comment mein paste kiya. [VERIFIED comment exists; INFERRED output correct]
- Ab tak main par purana app hai. App release PR abhi nahi bana. [VERIFIED brief]
- H10a se H10d tak customer screens ab done hain. Yeh PR unmein se aakhri bade hisse ka hai. [VERIFIED brief]

## 4. Real-Life Analogy
Poori PR ek dhaba counter hai. Counter par ek slip spike hai (jahan paid slips latki hain), aur ek regulars' card box hai (har customer ka card).

1. `app/src/App.tsx` = manager. Woh tap ko sahi counter par bhejta hai, "forget me" par card phaadta hai, aur join link deta hai.
2. `app/src/screens/OrdersScreen.tsx` = slip spike. Is phone ki har slip yahan hai, naya upar.
3. `app/src/screens/AccountScreen.tsx` = regular ka card. Naam, phone, address, alerts ki ghanti, din-raat ka lamp, suggestion box, aur card phaadne ka button.
4. `app/src/screens/PlacedScreen.tsx` = wahi slip. Ab "No. 1042" aur customer ki bhasha.
5. `app/src/screens/FeedbackSheet.tsx` = suggestion box. Counter ki ghanti bajne par khulta hai.
6. `app/src/ui/ui.css` = paint aur shelves, spike aur card box ke liye.
7. `app/tests/e2e/account.spec.ts` = inspector jo dono naye counters ko Day aur Night mein check karta hai.
8. `app/tests/e2e/shots.spec.ts` = photographer jo board check ke liye counters ki photo leta hai.

## 5. Is PR mein naye Concepts (5)
- **Short order number:** Order ki uuid ke pehle 8 characters "No. 0f0f0f0f" ki tarah dikhte hain. Pura id kabhi nahi dikhta. Analogy: slip par chhota number, ledger page nahi. Poori entry `concepts.delta.md` mein hai.
- **Customer words vs kitchen words:** Ek hi status ke do label hain. Kitchen "Ready" bolta hai, customer "Ready, rider picks up". Analogy: cook "ready" bolta hai, waiter "table par aa raha hai" bolta hai.
- **Window event as a bell:** Ek screen `gs-feedback` event bajata hai, doosri sunti hai. Props ki chain nahi. Analogy: counter ki ghanti. Kisi ne bajayi, box khul gaya.
- **Theme pin:** Customer ki chuni hui theme (`gs-theme`) clock ko rok deti hai. "By the clock" pin hata deta hai. Analogy: lamp ka manual switch ya timer.
- **One-way permission switch:** Browser alerts ki permission de sakta hai, wapas nahi le sakta. Isliye switch sirf on hota hai. Analogy: ek baar doorbell lag gayi, counter se unwire nahi hoti.

## 6. High-Level Flow
1. Customer "My orders" tab (ab "Your orders") tap karta hai. App step "orders" par jaata hai.
2. OrdersScreen is phone ke orders dikhata hai, naya upar, "No. <shortId>" ke saath.
3. Row tap hone par `App.openOrder` placed state set karta hai. PlacedScreen tracker (open) ya delivered (Order again) dikhata hai.
4. "You" tab khulta hai, AccountScreen aata hai. Agar order open hai, live strip status aur No. dikhati hai, tap par tracker khulta hai.
5. "Edit delivery details" name, phone, address ko jagah par badalta hai. Agli order ke saath save hota hai.
6. Look chips `pinTheme` call karte hain. Yeh `gs-theme` aur `data-theme` likhte hain.
7. "Use on another phone" link share karta hai (navigator.share), warna clipboard par copy karta hai.
8. "Send feedback" `gs-feedback` event bhejta hai. FeedbackSheet khul jaata hai.
9. "Forget me" poochta hai. Haan par signOut, `localStorage.clear()`, aur reload. [VERIFIED brief]

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/src/App.tsx` | Manager: openOrder, openLive strip, shareFromAccount, forgetMe. Ab har customer screen par framed true hai. (+35 / -5) |
| `app/src/screens/AccountScreen.tsx` | "You" board: details slip, alerts switch (sirf on), Look chips, feedback, Forget me. (+67 / -17) |
| `app/src/screens/OrdersScreen.tsx` | "Your orders" board: slip rows, tap se slip khulti hai, empty state. (+39 / -19) |
| `app/src/screens/PlacedScreen.tsx` | Slip: "No. <shortId>", STEP_WORDS customer words, onBack aur onAgain alag. (+10 / -7) |
| `app/src/screens/FeedbackSheet.tsx` | Suggestion box: gs-feedback event sunta hai aur khulta hai. (+7 / -0) |
| `app/src/ui/ui.css` | 23 naye rules: order rows, account dl, look section, switch row. (+23 / -0) |
| `app/tests/e2e/account.spec.ts` | Naya inspector: 9 tests, S1 se S8 (S8 Day aur Night mein). (+98) |
| `app/tests/e2e/shots.spec.ts` | Photographer: Orders, Account, empty Orders, Day aur Night mein. (+30) |

Chhote badlaav: bill.spec, customer-ui.spec, customer.spec, profile.spec, rider.spec ke headings aur test names badle gaye. [VERIFIED brief]

## 8. Pieces aapas mein kaise baat karte hain
- `main.tsx` App ko chalata hai. App ke paas OrdersScreen, AccountScreen, PlacedScreen hain. [VERIFIED brief]
- App `lib/kitchen` (shortId, statusLabel) aur `lib/profile` (orderSummary) use karta hai. [VERIFIED brief]
- AccountScreen `lib/theme` (readPin, pinTheme) aur ui TabBar use karta hai. [VERIFIED brief]
- AccountScreen window par `gs-feedback` bajata hai. FeedbackSheet use sunkar khulta hai. Koi prop ya context nahi. [VERIFIED brief]
- FeedbackSheet offline feedback localStorage se flush karta hai. Isi localStorage ko Forget me wipe karta hai. [VERIFIED read]

## 9. Pehle se kya badla
- Naye counters: "Your orders" aur "You". Slip par "No. <shortId>". Status ke customer words. [VERIFIED]
- Naye features: Edit delivery details, Look chips (Day, Night, By the clock), alerts switch, Use on another phone, Send feedback, Forget me. [VERIFIED]
- Files: 30 (12 png shots). Lines +334 / -60. [VERIFIED]
- Commits: a696647 (order number on slip, customer words on timeline), 446b1aa (Your orders and You screens), bf73554 (docs: F143 closed, prod migrations 0022 to 0026 applied). [VERIFIED]
- Docs: LEARNINGS (2 rows), discussions 2026-10-22 (2 owner lines), follow-ups F138, F141, F142, F143, process-trace rows 258, 260, 261, test-cases (1 row). [VERIFIED brief]

## 10. Macro Risks & Downstream Impact
1. **Forget me sab localStorage mitata hai.** Offline feedback queue aur theme pin bhi jaate hain. Agar phone offline tha aur feedback pending tha, woh chala jaata hai. Check: forgetMe ko flush-phir-wipe chahiye ya nahi. [VERIFIED read; App.tsx line 411 to 414]
2. **Har slip par current area ka kitchen naam dikhta hai.** Customer area badle to purani slips galat kitchen dikhayengi. Pilot mein ek kitchen hai, to abhi theek. Check: F142.6. [VERIFIED]
3. **Red-first paste PR body mein nahi hai.** Yeh process ka gap hai, code ka nahi. Check: rule 5. [VERIFIED]
4. **Global window event.** AccountScreen aur FeedbackSheet ek event se jude hain. Do sheets mount hon to dono khulenge. Abhi ek hi sheet hai, to asar kam hai. [INFERRED]
5. **Phone edit mein 6 se 9 wala check nahi.** Bill screen ka check is diff mein nahi hai. Galat phone agle order tak chup rahega. [INFERRED]
6. **openLive pehla open order leta hai.** Do open orders hon to ek hi strip dikhti hai. [VERIFIED]
7. **Prod par schema naya, main par app purana.** Prod par constraints 0022 se 0026 hain. Release PR tak purana app chalega. Reads same hain, par kuch ghanton ka gap hai. [INFERRED]
8. **"By the clock · 6 pm to 6 am" hard text hai.** lib/theme ke ghante badle to label purana rahega. [VERIFIED]
9. **shots.spec mein waitForTimeout(400).** Paanchva sleep. Flaky ya slow shots ka khatra. [VERIFIED]
10. **"today HH:MM" phone ki local date se.** Raat 23:50 ka order 00:10 par date ke saath dikhega. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- **Change area on You:** pin chip menu par yeh kaam karta hai. (F142.1)
- **Alerts switch off:** browser permission wapas nahi le sakta. (F142.3)
- **Per-step times on timeline:** sirf created aur updated time hain. (F141)
- **Kitchen naam har order par:** orders mein abhi kitchen naam nahi hai. (F142.6)
- **Countdown on live strip:** sirf status aur number. (F142.4)
- **Router:** chaar steps state mein hain since story #48. Ponytail: router nahi. [VERIFIED brief]

## 12. Testing Story
- **Red-first proof:** PR body mein koi red run paste nahi hai. [VERIFIED]
- **Counts:** 227 unit, 203 e2e, typecheck clean. Yeh coder ne PR body mein likha hai. [INFERRED from body]
- **account.spec.ts naye tests:**
  - S1: slip tap delivered khulta hai, "Order again" dikhta hai.
  - S2: Edit delivery details.
  - S3: Look chips Night pin karte hain, By the clock pin hatata hai (clock noon par set).
  - S4: live strip tracker khulta hai.
  - S5: Send feedback dialog khulta hai.
  - S6: Forget me pehle poochta hai, phir clear() chalta hai (Storage.prototype.clear patch karke dekha gaya).
  - S7: Use on another phone link copy karta hai, join= ke saath.
  - S8: axe serious ya critical = none, You aur Your orders par, Day aur Night dono mein. [VERIFIED brief]
- **Moved tests:** "My orders" se "Your orders" headings. "no order id" se "short number shown, whole id never". rider S2 ab "Ready, rider picks up" expect karta hai. [VERIFIED]
- **Shots:** Orders, Account, S-EmptyOrders, Day aur Night mein, 390 x 844. [VERIFIED]

## 13. Trade-offs & Alternatives

| Chuna | Kyun | Kya chhoda |
|---|---|---|
| Ek PlacedScreen Placed, Tracker, Delivered ke liye. List se bhi khulta hai. | Ek status-driven screen | Alag "order detail" screen |
| Window event feedback ke liye | Ek button ke liye props ki chain nahi | Explicit wiring (aasaan trace) |
| localStorage.clear() Forget me ke liye | Ek line, sab saaf | Keyed wipe jo offline feedback queue bachaye |
| Current area ka kitchen naam har slip par | Orders mein kitchen naam nahi | Area badlne par sahi naam |

## 14. Patterns is PR se
- **Window event as bell:** ek screen bajata hai, doosri sunti hai. Dekho: AccountScreen aur FeedbackSheet.
- **One status-driven screen:** ek screen, status ke hisaab se alag view. Dekho: PlacedScreen.
- **Customer words mapping:** ek status, do label. Dekho: PlacedScreen STEP_WORDS.
- **Stored choice beats clock:** pin clock ko rokta hai. Dekho: AccountScreen aur lib/theme.
- **One-way switch:** sirf on hota hai, kyunki browser wapas nahi le sakta. Dekho: AccountScreen alerts.
- **Test moves with copy:** har heading badli, uska test bhi badla. Dekho: moved tests list.

## 15. AI-Review Lens
- **Trust:** tests copy ke saath badle gaye. Har heading badli, uska test edit hua. "Whole id never shows" teen baar assert hua hai. axe dono themes mein chalta hai. [VERIFIED brief]
- **Interrogate:** ek confident line jo sab wipe karti hai (localStorage.clear). Ek global event bus ek button ke liye. "9 tests pass" ka claim bina red run ke. Kitchen ka naam galat source se (area kitchen har slip par). [VERIFIED brief]

## 16. Questions

### Top 3 abhi poocho
1. **Forget me aur offline feedback (Risk):** `app/src/App.tsx` line 411. Forget me sab mitata hai, offline feedback bhi. Pehle flush, phir wipe, ya theek hai?
2. **Kitchen naam har slip par (Assumptions):** `app/src/screens/OrdersScreen.tsx` line 38. Area badle to purani slips galat kitchen dikhayengi. Order row mein kitchen naam kab aayega?
3. **Red test ka paste (Testability):** `app/tests/e2e/account.spec.ts` line 1. PR body mein red paste nahi hai. Pehla red run kahan hai? Agle PR body mein paste karo.

### Poora bank
<details><summary>Poora question bank</summary>

### Purpose
- `app/src/screens/AccountScreen.tsx` line 19: look state readPin se shuru hota hai aur pick() pinTheme likhta hai. Agar kal menu par bhi theme badalne ki jagah aayi to do jagah ka state sync kaise rahega?
- `app/src/screens/PlacedScreen.tsx` line 39: STEP_WORDS sirf ready aur delivered badalta hai; baaki kitchen ke labels (Accepted, Cooking). Customer "Accepted" samjhega? Boards par in steps ke liye kya likha hai?

### Understanding
- `app/src/App.tsx` line 392: openOrder purane order se placed state banata hai (snapshot). Agar us order ka live update aaye, kya `tracked` use pakad leta hai, ya tracker purana reh jata hai jab tak refresh na ho?
- `app/src/screens/AccountScreen.tsx` line 51: Alerts switch sirf on karta hai, off nahi (F142.3). Customer ko yeh toota switch lagega? "Blocked in your phone settings" line kaafi hai, ya switch ki jagah ek button "Turn on" saaf hota?
- `app/src/screens/OrdersScreen.tsx` line 11: "today HH:MM" phone ki local date se tay hota hai. Raat 23:50 ka order 00:10 par "24 Oct 23:50" ban jayega. Theek hai, ya "yesterday" chahiye?

### Assumptions
- `app/src/App.tsx` line 397: openOrderNow = pehla open order. Ek customer ke do open orders ho to strip sirf pehla dikhayegi. Pilot mein ek phone se do orders ek saath ho sakte hain?
- TOP `app/src/screens/OrdersScreen.tsx` line 38: Har slip par current area ka kitchenName dikhta hai (F142.6). Customer area badle to purani slips galat kitchen dikhayengi. Pilot ek kitchen hai to abhi theek; order row mein kitchen naam kab aayega, aur tab tak yeh line hatana safe nahi?

### Alternatives
- `app/src/App.tsx` line 400: share nahi to clipboard, clipboard bhi blocked (iPhone private mode) to "Could not share". Link ko text mein dikha dena sasta fallback hota, taaki customer khud copy kare?
- `app/src/screens/AccountScreen.tsx` line 62: Send feedback ek window event `gs-feedback` se sheet kholta hai: counter ki ghanti. Prop ya context ke bajaye event kyun? Teen aur screens yahi karein to kaun track karega kaun kise bula raha hai?

### Risk
- TOP `app/src/App.tsx` line 411: forgetMe `localStorage.clear()` sab mitata hai: theme pin aur offline feedback queue bhi (FeedbackSheet usi localStorage se flush karta hai). Phone offline tha aur ek feedback pending tha, to woh chala jayega. Theek hai, ya pehle flush, phir wipe?
- `app/src/screens/AccountScreen.tsx` line 38: Phone edit sirf digits aur 10 max rakhta hai; 6 se 9 se shuru hona yahan nahi check hota. Bill par check hai? Galat phone next order tak chup baitha rahega?
- `app/src/screens/FeedbackSheet.tsx` line 41: Listener mount par lagta hai. Agar FeedbackSheet kabhi do baar mount ho (do roles ek page, split mode) to ek ghanti se do sheets khulenge. Ho sakta hai?
- `app/tests/e2e/shots.spec.ts` line 125: waitForTimeout(400) shot se pehle: is file ka paanchva sleep. Font ya animation ka wait hai? `document.fonts.ready` ya ek visible assertion sasta aur sthir hota.

### Impact
- `app/src/App.tsx` line 521: framed ab har customer screen par true hai, pehle sirf menu, bill, placed. Kitchen aur rider lock par kuch badla? (lock customer nahi to false, samajh sahi?)
- `app/src/screens/PlacedScreen.tsx` line 76: Timeline ab customer words dikhata hai aur rider.spec bhi "Ready, rider picks up" expect karta hai. Kitchen aur rider screens ka timeline yahi component hai? Unhe bhi customer words mil gaye?

### Testability
- TOP `app/tests/e2e/account.spec.ts` line 1: Rule 5: red test pehle, failure PR mein paste. PR body mein red paste nahi hai, sirf "9 tests". Pehla red run kahan hai? Agla PR body mein paste karo.
- `app/tests/e2e/account.spec.ts` line 61: S6 Storage.prototype.clear patch karta hai kyunki test har load par pin seed karta hai. Chalaak, par asli wipe ka proof nahi (reload ke baad kya dikhta hai). Seed ko ek baar lagana aur reload ke baad pin screen assert karna behtar?
- `app/src/screens/AccountScreen.tsx` line 64: "Yes, forget" se signOut fail ho (offline) to bhi local wipe chalta hai. Test S6 sirf clear() dekhta hai; reload ke baad pin screen aana check nahi hota. Ek assertion aur chahiye?

### Future
- `app/src/screens/AccountScreen.tsx` line 58: "By the clock · 6 pm to 6 am" chip par hard text hai. lib/theme ka ghanta badla to yeh label purana reh jayega. Ghanta ek jagah se aana chahiye?
- `docs/follow-ups.md` line 149: F143: prod par 0022 se 0026 lag gaye, par main par purana app hai jab tak release PR nahi. Beech ke ghanton mein purana app + naya schema: kuch tootega? (data rules, functions, indexes; reads same, samajh sahi?)

</details>

## 17. Self-check (light, 2-3)
1. Forget me dabane par kya mitta hai, aur kya bachna chahiye tha? Offline feedback ka kya hoga?
2. Ek customer ke do open orders hon, to live strip kaunsa order dikhayegi? Yeh pilot mein hota hai ya nahi, kaise pata karoge?
3. Is PR ka red test kahan paste hai? Agar nahi hai, kaunsa rule toota?

---

## Inline comments

Har comment ek teaching question hai. Sync 24 Oct: sab 20 answered, 6 fixed (9e35759), sab resolved.

<!-- gh-comment-id: 4367692115 -->
- **File:** `app/src/App.tsx` · **Line:** 411 · **Category:** TOP · Risk
- **Question:** forgetMe `localStorage.clear()` sab mitata hai: theme pin aur offline feedback queue bhi (FeedbackSheet usi localStorage se flush karta hai). Phone offline tha aur ek feedback pending tha, to woh chala jayega. Theek hai, ya pehle flush, phir wipe?
- **Reply (klickbae8yt-star):** Accepted as is: Forget me means forget, so an unsent offline report goes with the rest. It is one tap away from a confirm, and the report can be sent again. Noted as follow-up F144 (flush the queue before the wipe) on feat/194.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692121 -->
- **File:** `app/src/App.tsx` · **Line:** 392 · **Category:** Understanding
- **Question:** openOrder purane order se placed state banata hai (snapshot). Agar us order ka live update aaye, kya `tracked` use pakad leta hai, ya tracker purana reh jata hai jab tak refresh na ho?
- **Reply (klickbae8yt-star):** It picks the live update. `tracked` is `orders.find(id)` on the live list, and `placed` is only the fallback when the list has not loaded. The snapshot lasts until the next poll, same as after a page load.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692124 -->
- **File:** `app/src/App.tsx` · **Line:** 397 · **Category:** Assumptions
- **Question:** openOrderNow = pehla open order. Ek customer ke do open orders ho to strip sirf pehla dikhayegi. Pilot mein ek phone se do orders ek saath ho sakte hain?
- **Reply (klickbae8yt-star):** The strip shows the newest open order (the list is newest first); a second open order stays visible in Your orders. The pilot phone can place two orders, so this is a choice, not a cap. If it bites in the pilot, the strip becomes a count.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692128 -->
- **File:** `app/src/App.tsx` · **Line:** 400 · **Category:** Alternatives
- **Question:** share nahi to clipboard, clipboard bhi blocked (iPhone private mode) to "Could not share". Link ko text mein dikha dena sasta fallback hota, taaki customer khud copy kare?
- **Reply (klickbae8yt-star):** Fixed in 9e35759 on release/app-ink-v3 (PR #221): when share and clipboard both fail, the note shows the link itself ("Copy this link by hand: ..."). Only when the link cannot be made does it say "Try again".
- **Status:** fixed 9e35759 (release #221), resolved 24 Oct

<!-- gh-comment-id: 4367692131 -->
- **File:** `app/src/App.tsx` · **Line:** 521 · **Category:** Impact
- **Question:** framed ab har customer screen par true hai, pehle sirf menu, bill, placed. Kitchen aur rider lock par kuch badla? (lock customer nahi to false, samajh sahi?)
- **Reply (klickbae8yt-star):** Right: `framed` is `lock === "customer" && role === "customer"`, so kitchen, rider, ops and split stay as they were. Every customer screen is now an Ink board, so the frame covers the whole customer flow.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692136 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 62 · **Category:** Alternatives
- **Question:** Send feedback ek window event `gs-feedback` se sheet kholta hai: counter ki ghanti. Prop ya context ke bajaye event kyun? Teen aur screens yahi karein to kaun track karega kaun kise bula raha hai?
- **Reply (klickbae8yt-star):** FeedbackSheet is mounted once in App, outside the customer tree, and already owns its open state. The event keeps the sheet decoupled from the screens, as the demo bar does. If a third caller comes, it becomes an `open` prop on the sheet, not a second event.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692141 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 38 · **Category:** Risk
- **Question:** Phone edit sirf digits aur 10 max rakhta hai; 6 se 9 se shuru hona yahan nahi check hota. Bill par check hai? Galat phone next order tak chup baitha rahega?
- **Reply (klickbae8yt-star):** The bill checks it (`lib/validate.ts`: ten digits, first 6 to 9) before an order can be placed, so a wrong phone never reaches the kitchen. The You screen is a draft of the bill, so it stays lenient. Same check on You can come with H9 feedback.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692143 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 51 · **Category:** Understanding
- **Question:** Alerts switch sirf on karta hai, off nahi (F142.3). Customer ko yeh toota switch lagega? "Blocked in your phone settings" line kaafi hai, ya switch ki jagah ek button "Turn on" saaf hota?
- **Reply (klickbae8yt-star):** Known, F142.3: a browser lets a page subscribe but not revoke the permission, so off is in the phone settings. The switch is disabled once on and the sub line says why. A "Turn on" button instead of a switch is a board change; it goes to the H9 blind test list
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692145 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 58 · **Category:** Future
- **Question:** "By the clock · 6 pm to 6 am" chip par hard text hai. lib/theme ka ghanta badla to yeh label purana reh jayega. Ghanta ek jagah se aana chahiye?
- **Reply (klickbae8yt-star):** Fixed in 9e35759 on release/app-ink-v3 (PR #221): `lib/theme.ts` exports `NIGHT = { from: 18, to: 6 }` and `clockLabel()`; the chip reads it. Unit test added. `index.html` still repeats the two numbers for the first paint, said in the comment there.
- **Status:** fixed 9e35759 (release #221), resolved 24 Oct

<!-- gh-comment-id: 4367692148 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 64 · **Category:** Testability
- **Question:** "Yes, forget" se signOut fail ho (offline) to bhi local wipe chalta hai. Test S6 sirf clear() dekhta hai; reload ke baad pin screen aana check nahi hota. Ek assertion aur chahiye?
- **Reply (klickbae8yt-star):** Fixed in 9e35759 on release/app-ink-v3 (PR #221): S6 now seeds the pin once by hand (not on every load), taps Yes, forget, and asserts the pin screen "Where do we deliver?" after the reload and `gs-pin` null. The signOut catch is unchanged: offline, the local
- **Status:** fixed 9e35759 (release #221), resolved 24 Oct

<!-- gh-comment-id: 4367692150 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 19 · **Category:** Purpose
- **Question:** look state readPin se shuru hota hai aur pick() pinTheme likhta hai. Agar kal menu par bhi theme badalne ki jagah aayi to do jagah ka state sync kaise rahega?
- **Reply (klickbae8yt-star):** The theme has one source: the `gs-theme` key plus `data-theme` on the document, both written by `pinTheme`. `look` is only this screen's mirror for the chips. A second control would call the same `pinTheme` and read `readPin` on mount, so they cannot drift.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692152 -->
- **File:** `app/src/screens/OrdersScreen.tsx` · **Line:** 38 · **Category:** TOP · Assumptions
- **Question:** Har slip par current area ka kitchenName dikhta hai (F142.6). Customer area badle to purani slips galat kitchen dikhayengi. Pilot ek kitchen hai to abhi theek; order row mein kitchen naam kab aayega, aur tab tak yeh line hatana safe nahi?
- **Reply (klickbae8yt-star):** Known, F142.6. The order row has `kitchen_id` but no name, and the pilot is one kitchen, so the line is right today. The kitchen name joins the order read in H12 (admin, more than one kitchen); until then the line stays because an empty slip reads worse.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692153 -->
- **File:** `app/src/screens/OrdersScreen.tsx` · **Line:** 11 · **Category:** Understanding
- **Question:** "today HH:MM" phone ki local date se tay hota hai. Raat 23:50 ka order 00:10 par "24 Oct 23:50" ban jayega. Theek hai, ya "yesterday" chahiye?
- **Reply (klickbae8yt-star):** Fixed in 9e35759 on release/app-ink-v3 (PR #221): a slip from the day before says "yesterday 23:50". Older ones keep the date.
- **Status:** fixed 9e35759 (release #221), resolved 24 Oct

<!-- gh-comment-id: 4367692155 -->
- **File:** `app/src/screens/PlacedScreen.tsx` · **Line:** 39 · **Category:** Purpose
- **Question:** STEP_WORDS sirf ready aur delivered badalta hai; baaki kitchen ke labels (Accepted, Cooking). Customer "Accepted" samjhega? Boards par in steps ke liye kya likha hai?
- **Reply (klickbae8yt-star):** The boards (journey canvas, Tracker artboard) show Placed, Accepted, Cooking, Ready, At your door as stamps, so Accepted and Cooking are board words. Only Ready and Delivered got longer customer lines because the board wrote them that way.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692157 -->
- **File:** `app/src/screens/PlacedScreen.tsx` · **Line:** 76 · **Category:** Impact
- **Question:** Timeline ab customer words dikhata hai aur rider.spec bhi "Ready, rider picks up" expect karta hai. Kitchen aur rider screens ka timeline yahi component hai? Unhe bhi customer words mil gaye?
- **Reply (klickbae8yt-star):** No: `Timeline` is used only by PlacedScreen (the customer tracker). Kitchen and rider keep their own lists with the kitchen labels. rider.spec expects the customer words because that test reads the customer's tracker after the rider's step.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692159 -->
- **File:** `app/src/screens/FeedbackSheet.tsx` · **Line:** 41 · **Category:** Risk
- **Question:** Listener mount par lagta hai. Agar FeedbackSheet kabhi do baar mount ho (do roles ek page, split mode) to ek ghanti se do sheets khulenge. Ho sakta hai?
- **Reply (klickbae8yt-star):** It cannot: FeedbackSheet is mounted once in App (line 543), outside the role views. Split mode is one App with one sheet.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692163 -->
- **File:** `app/tests/e2e/account.spec.ts` · **Line:** 1 · **Category:** TOP · Testability
- **Question:** Rule 5: red test pehle, failure PR mein paste. PR body mein red paste nahi hai, sirf "9 tests". Pehla red run kahan hai? Agla PR body mein paste karo.
- **Reply (klickbae8yt-star):** Right, the red run was not pasted. The next PR body (feat/194, H11) carries the first red run of each new test.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367692166 -->
- **File:** `app/tests/e2e/account.spec.ts` · **Line:** 61 · **Category:** Testability
- **Question:** S6 Storage.prototype.clear patch karta hai kyunki test har load par pin seed karta hai. Chalaak, par asli wipe ka proof nahi (reload ke baad kya dikhta hai). Seed ko ek baar lagana aur reload ke baad pin screen assert karna behtar?
- **Reply (klickbae8yt-star):** Fixed in 9e35759 on release/app-ink-v3 (PR #221): the `Storage.prototype.clear` patch is gone. S6 seeds once, wipes, and asserts the pin screen after the reload. See the other S6 thread.
- **Status:** fixed 9e35759 (release #221), resolved 24 Oct

<!-- gh-comment-id: 4367692167 -->
- **File:** `app/tests/e2e/shots.spec.ts` · **Line:** 125 · **Category:** Risk
- **Question:** waitForTimeout(400) shot se pehle: is file ka paanchva sleep. Font ya animation ka wait hai? `document.fonts.ready` ya ek visible assertion sasta aur sthir hota.
- **Reply (klickbae8yt-star):** Fixed in 9e35759 on release/app-ink-v3 (PR #221): this sleep is now `await page.evaluate(() => document.fonts.ready)`. The other four waits in the file cover transitions on earlier screens; they go when the shots spec moves to visible assertions, one PR.
- **Status:** fixed 9e35759 (release #221), resolved 24 Oct

<!-- gh-comment-id: 4367692169 -->
- **File:** `docs/follow-ups.md` · **Line:** 149 · **Category:** Future
- **Question:** F143: prod par 0022 se 0026 lag gaye, par main par purana app hai jab tak release PR nahi. Beech ke ghanton mein purana app + naya schema: kuch tootega? (data rules, functions, indexes; reads same, samajh sahi?)
- **Reply (klickbae8yt-star):** Nothing breaks. The old app writes only orders and order_events; 0022 constrains kitchens and menu_items, 0023 kitchen_staff, 0024 to 0026 add functions the old app never calls. Reads are the same tables. The customer flow on prod (menu, order) was exercised a | Correction to my last line: no order was placed on prod and I did not run the old app against it. What I checked after the apply, read-only through the anon key: kitchens (both active, each with a pin) and menu_items both read 200. The rest of the reasoning st
- **Status:** answered, resolved 24 Oct

---

## Handoff

State: 20 posted · 0 need-fix · 20 open · actor: owner (merge), then coder

Owner lines (chat, Romanized Hindi): PR #220 approve ho chuka hai. Ab merge karo. Coder block ko coder session mein paste karo.

Coder block:

```
To coder, from reviewer, re PR #220:
1. Approved. Nothing must change. 20 teaching questions are inline, 3 marked TOP (Forget me wipes the offline feedback queue; no red-first paste in the body; the area's kitchen on every slip). Reply on each in 1-2 sentences; a fix goes as a commit on this layer and is named in the reply.
2. After the owner merges #220, open the app release PR: a release branch cut from main, app/ and design/ taken from dev, the empty-diff check pasted in the body.
3. Continue development: start story #194 "H11 UI rollout: rider and kitchen" on feat/194-rider-kitchen-ui from dev once the release PR is open.
Need from you: the thread replies and the release PR number.
```

Owner block:

```
To owner, from reviewer, re PR #220:
1. Now: merge PR #220 (feat/193-customer-account -> dev) and delete the branch.
2. After the merge: paste the coder block to the coder session.
3. Not yet: the app release PR to main; the coder opens it after the merge, you merge it after its approve block.
Merge: now, PR #220.
Need from you: the merge sha.
```

## What happened after review
- Review comments post hue: review 5638912878 (APPROVE) ke saath 20 inline questions. [VERIFIED brief]
- Replies (sync 24 Oct): 20 answered, 6 fixed in 9e35759 on release/app-ink-v3 (PR #221), 0 open. Sab 20 threads GitHub par resolved. [VERIFIED]
- Merge: MERGED 25efc9e (24 Oct). Release PR #221 (app/ + design/ to main) APPROVE 5638997327 by satvik-jain-iitd. Fix commit 9e35759 is on the release branch and cherry-picked on feat/194 (98b053a); dev matches main after #194 merges. [VERIFIED]
- Is chapter ka bada sabak: approve ka matlab "kuch badlo nahi" hai, lekin sawaal phir bhi poochne hain. Forget me jaise ek line wale code mein sabse bada asar chhupa ho sakta hai.
