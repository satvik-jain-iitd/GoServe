# PR #222 — feat(app): Ink v3 rider app, boards R1 to R9 (#194)

- **Branch:** feat/194-rider-kitchen-ui → dev
- **Author:** klickbae8yt-star
- **Story / issue:** #194 "H11 UI rollout: rider and kitchen" (epic E18, #182). Layer 1 of 2. #223 (kitchen) stacks on it.
- **Status:** OPEN, approved (review 5639179226, APPROVE). Merge waits for Guard green. [VERIFIED]
- **Files:** 50 (18 png, 11 docs) · **Lines:** +870 / -79 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5639179226 (APPROVE) [VERIFIED]
- **Head:** ab5c8e4 [VERIFIED]
- **CI:** App pass, Site pass, Guard fail. Cause: one docs commit subject is 75 chars (3998f05). The reword waits for the owner's yes to a force push. [VERIFIED]
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/222

---

> Dhaba ka delivery boy ab ek slip, ek cash pouch aur ek gate ke saath kaam karta hai. Rider app ke teen tab hain: Job, Today, Me.

---

## Overall review

## 1. Ek-line logline
> `Rider app naye boards par ban gaya: gate, ek slip ek waqt (Job), cash ka hisaab (Today), aur apna card (Me). Cash ka din phone ki date se banta hai, aur Guard abhi red hai.`

## 2. Big Picture (Story & Goal)
- Yeh PR story #194 "H11 UI rollout: rider and kitchen" ka rider wala hissa hai. Epic E18 (#182) ka hissa hai. [VERIFIED]
- Rider ko ek waqt mein ek hi delivery dikhti hai. Pickup, delivery aur cash ka hisaab ek hi jagah par hai. [VERIFIED brief flow]
- Story #194 maangti hai: rider aur kitchen ko jeete hue skill se rebuild karo, test ids same rahen. [VERIFIED]
- Aria-labels same rakhe gaye hain: "Pick up <id>", "Arriving <id>", "Delivered <id>". Heading words boards par gaye hain: Delivery, Deliveries, No. <id>. [VERIFIED]
- Extra cheezein: `Tabs` generic component dono staff apps ke liye, aur Order type mein kitchen_id aur rider_id. Missing: Night shots (file cap). [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Story #194 ne rider aur kitchen dono ko naye skill par maanga. Yeh PR rider wala aadha hissa hai. [VERIFIED]
- #223 (kitchen) is PR ke upar stack hai. Pehle yeh merge hoga, phir #223. [VERIFIED]
- Commit 98b053a ek fix cherry-pick hai. Yeh #221 par pehle review ho chuka hai. Isme theme, AccountScreen, OrdersScreen aur unki tests hain. [VERIFIED]
- Guard red hai, kyunki ek docs commit subject 75 chars ka hai. Owner ke yes ke baad reword, force push, phir `gh stack sync`. [VERIFIED]
- Pehle wala rider design kaisa tha, yeh brief mein nahi tha.

## 4. Real-Life Analogy
Poori PR ek dhaba ke delivery boy ki kahani hai. Usko ek slip jeb mein milti hai, ek cash pouch milta hai, aur owner gate par uska chehra dekhta hai.

1. `app/src/screens/RiderGate.tsx` = gate. Google face check (R1), "rider list par nahi" (R2), aur online hone par location beacon.
2. `app/src/screens/RiderScreen.tsx` = jeb. Ek waqt ek slip (Job), cash pouch (Today), apna card (Me).
3. `app/src/lib/rider.ts` = pouch ka hisaab. Kaunsi delivery aaj ki hai, kitna cash haath mein hai, aur kaunsi kitchen card par pickup hai.
4. `app/src/App.tsx` = manager. Slip ke hisaab se kitchen card laata hai, aur rider app ko frame karta hai.
5. `app/src/ui/index.tsx` (Tabs) = apron ki teen jeb: Job, Today, Me, count badge ke saath.
6. `app/tests/e2e/rider-ink.spec.ts` = inspector jo R1 se R9 tak check karta hai.

## 5. Is PR mein naye Concepts (3-6)

### Render-prop gate
- **Naam:** Render-prop gate
- **Matlab:** Gate apni state (online, flip, signOut) screen ko ek function ke through deta hai. Screen gate ke andar wrap nahi hoti.
- **Kyun matter karta hai:** Me tab ko online switch aur Sign out chahiye. Context banane ki zaroorat nahi padi.
- **Real-life link:** Gatekeeper badge aur chaabi boy ko deta hai, boy andar uska use karta hai.

### Ek kaam ek waqt
- **Naam:** One job in hand
- **Matlab:** Screen sirf `riderOrders[0]` dikhata hai. Baaki "N more waiting" hain.
- **Kyun matter karta hai:** Rider ka dhyan ek hi delivery par rehta hai. Do ready orders mein se chunne ka option nahi hai.
- **Real-life link:** Jeb mein ek slip, baaki hook par.

### Sticky done slip
- **Naam:** Sticky done slip (`doneId`)
- **Matlab:** Delivered slip tab tak screen par rehti hai jab tak rider "Next delivery" na dabaye. Naya job bhi aa jaye to bhi.
- **Kyun matter karta hai:** Rider paid slip ko padh le, phir agla job le. Reload par `doneId` gayab ho jata hai.
- **Real-life link:** Boy pehle paid slip padhta hai, phir agli slip uthata hai.

### Aaj ka hisaab phone ki ghadi se
- **Naam:** Today by the phone's clock
- **Matlab:** `deliveredToday` phone ki date se milata hai. Cash in hand midnight par reset hota hai.
- **Kyun matter karta hai:** Raat 23:30 ki delivery aur 00:10 ka hand-over, dono alag din mein ginte hain. Cash haath mein ho to bhi zero dikh sakta hai.
- **Real-life link:** Pouch ko deewar ki ghadi se ginte hain, shift se nahi.

### Generic Tabs
- **Naam:** Generic Tabs
- **Matlab:** Ek tab component dono staff apps ke liye hai. Role ke hisaab se tab chunta hai. Badge count dikhata hai.
- **Kyun matter karta hai:** Rider aur kitchen ka tab bar ek jaisa dikhta hai. Code ek hi jagah hai.
- **Real-life link:** Teen jeb wala apron, wahi apron cook bhi pehanta hai.

## 6. High-Level Flow
1. `/rider/` par RiderGate chalta hai: session, getUser (anonymous?), getRider. Phir R1 (anonymous), R2 (signed in, rider row nahi), ya app.
2. Job tab: `riderOrders(orders)[0]` hi job hai. App us job ki kitchen card laata hai.
3. R5 Pick up (status out_for_delivery). Phir R6 Arriving (event, button disable hota hai), Delivered (status).
4. R7: delivered slip, "Cash collected" ke saath, "Next delivery" tak.
5. Today tab: `deliveredToday` aur `cashInHand` se hisaab.
6. Me tab: online switch (flip), phone, Sign out (signOut, phir reload).
7. Online ke time gate har 30 second location bhejta hai (yeh pehle jaisa hai).

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/src/App.tsx` | Manager. Kitchen card fetch karta hai (jobKitchenId + fetchKitchen), rider screen render karta hai, rider lock ke liye frame karta hai. SignIn shell mein chhup jata hai. |
| `app/src/lib/rider.ts` | Pouch ka hisaab: RiderGateState type, fetchKitchen, deliveredToday, cashInHand, hhmm, firstName. |
| `app/src/screens/RiderGate.tsx` | Gate: R1 Sign in to ride, R2 Not a rider yet (Check again, Sign out). Anonymous check, aur children ko state function ke through deta hai. |
| `app/src/screens/RiderScreen.tsx` | Jeb: Job tab (R3 to R7), Today (R8), Me (R9). |
| `app/src/ui/index.tsx` | Tabs generic: bottom tabs job, today, me, new, cooking, kitchen, badge ke saath. |
| `app/src/ui/ui.css` | Rider ke rules: deliver block, call row, cash, state dot, tab badge. |
| `app/src/lib/kitchen.ts` | Order type mein kitchen_id aur rider_id (+1 line). |
| `app/src/lib/theme.ts`, AccountScreen, OrdersScreen | #220 fix ka cherry-pick 98b053a (#221 par reviewed). |
| `app/tests/e2e/rider-ink.spec.ts` | Naya test: S1 job flow, S2 Today + cash, S3 Me, S4 offline se online, S5 not a rider, S6 axe (Day aur Night), S7 sign in to ride. |
| Moved tests (apps.spec, kitchen-account, rider-account, rider.spec, staff-gate, staff-ui, helpers, shots.spec) | Headings aur labels ko naye boards ke hisaab se badla. |
| `docs/follow-ups.md`, LEARNINGS, trace, test-cases | F145 (7 deviations), 4 LEARNINGS rows, trace rows, test-cases row. |
| `pr-220-orders-you.md` aur review notebook files | #220 ka review notebook (362 lines). Yeh is feature PR mein aaye hain. |

## 8. Pieces aapas mein kaise baat karte hain
- `App.tsx` gate ko call karta hai. Gate `RiderScreen` ko apni state function ke through deta hai.
- `RiderScreen` `rider.ts` ke helpers use karta hai: aaj ki delivery ginna, cash ginna.
- `App.tsx` jis slip ko haath mein hai, uski kitchen card fetch karke screen ko deta hai.
- `ui/index.tsx` ka Tabs component rider screen ke tabs banata hai. #223 mein kitchen bhi yahi use karega.
- `lib/kitchen.ts` ka Order type `kitchen_id` aur `rider_id` leta hai.

## 9. Pehle se kya badla
- Total: 50 files (18 png, 11 docs). +870 / -79. [VERIFIED]
- App code: App.tsx (+21/-9), rider.ts (+21/-2), RiderGate.tsx (+45/-12), RiderScreen.tsx (+147/-28), ui/index.tsx (+20), ui.css (+19), kitchen.ts (+1). [VERIFIED]
- Ek naya test file: rider-ink.spec.ts (+93). [VERIFIED]
- Tests ke headings aur labels naye boards ke hisaab se badle. Test ids same rahe. [VERIFIED]
- Docs aur review notebook files is PR mein hain. Woh 11 of 50 file slots le rahe hain. [VERIFIED]

## 10. Macro Risks & Downstream Impact
- **Cash ka din (bada):** `deliveredToday` aur `cashInHand` phone ki local date use karte hain. 23:30 ki delivery aur raat ke hand-over par cash zero dikh sakta hai. Check: 23:30 delivery wala test. [VERIFIED]
- **R7 slip ka order (bada):** Delivered slip naye job se pehle check hota hai. Naya job "Next delivery" tak chhup sakta hai. Reload par `doneId` jata hai. Check: R7 ke saath naya job wala test. [VERIFIED]
- **Not delivered (medium):** Chhota text button, bina confirm. Teesra action (riderActions) mein kya hota hai, woh is diff mein nahi hai. [VERIFIED button; INFERRED effect]
- **Anonymous default (medium):** getUser fail ho to anonymous true rehta hai. Offline rider ko "Sign in to ride" dikh sakta hai. [INFERRED]
- **Guard red (abhi):** 75-char subject. Merge ruka hai. Force push ke baad `gh stack sync` chahiye, taaki #223 bhi follow kare. [VERIFIED]
- **Lockup file (chhota):** gate par lockup-day.png Night mein bhi hai (F145.7). [VERIFIED]
- **Copy ka vaada (chhota):** "every 30 seconds" hard text hai, LOCATION_EVERY_MS se juda nahi. Clock chip wala drift yahan bhi ho sakta hai. [VERIFIED]
- **Do numbers (medium):** Rider ka "Cash in hand" sirf apna cash hai. Kitchen ka "on the slips" (#223) sab delivered total hai. Do alag numbers ho sakte hain. [INFERRED]
- **Cash payment mode:** cashInHand `paid_by` unset ya "cash" ko cash maanta hai. "Collect cash" copy ka dusra mode abhi nahi hai. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Pin code line, Rides for row, last-ping time, early minutes. Reason: F145 (data nahi hai, ya board ke extra hain). [VERIFIED]
- Night shots. Reason: 50 file cap. [VERIFIED]
- Naya job aane par ring ya sound. Reason: push exist karta hai (enablePush), is diff mein audio nahi. [VERIFIED]
- Today rows par kitchen naam. Reason: orders mein kitchen_id hai, naam nahi (F142.6). [VERIFIED]

## 12. Testing Story
- Red-first proof PR body mein paste hai. Teen failures quote hain: "Pick up at" not found, "You are offline" heading not found, "Not a rider yet" not found. [VERIFIED]
- Counts: 228 unit, 227 e2e (coder ka count). [INFERRED]
- rider-ink S1 se S7 tak, jaise cast mein hai. S6 axe Day aur Night mein chalta hai. Lekin S6 sirf Job (job ke saath), Today, Me scan karta hai. R3, R7, R1, R2 scan nahi hote. [VERIFIED]
- Moved tests "Pick up 0f0f0f0f" jaise labels rakhte hain. Helpers /auth/v1/user ko anonymous flag ke saath jawab dete hain. [VERIFIED]
- Shots: R screens sirf Day mein. Board shots unke saath. [VERIFIED]

## 13. Trade-offs & Alternatives

| Choice | Kyun | Kya chhoda |
|---|---|---|
| Ek job in hand, list nahi | Board R5 ke hisaab se | Ready orders mein se chunne ka option |
| Render-prop gate | Me aur R3 ko flip aur signOut chahiye | Context |
| Aaj ka din phone ki date se | Ek line ka kaam | Shift wala din |
| Night shots drop | File cap | Night fit check PR mein |

## 14. Patterns is PR se
- **Render-prop:** gate apni state function ke through deta hai. RiderGate.tsx.
- **Generic component:** ek Tabs, kai staff apps. ui/index.tsx.
- **Sticky state:** `doneId` ek slip ko tab tak rokta hai jab tak user agla na chune. RiderScreen.tsx.
- **Test contract:** aria-labels rakhe, taaki purane tests har button dhoondh lein. Moved tests.

## 15. AI-Review Lens
- **Trust karo:** aria-labels rakhe gaye hain, taaki purane tests chalein. Red run paste hai. Gate customer welcome se dobara use hua hai (lockup, zigzag, slip). [VERIFIED]
- **Interrogate karo:** copy jo vaada karta hai ("every 30 seconds", "hand over tonight") aur code se link nahi hai. Cash screen par date-based "aaj". Bina confirm ka text button. Axe scan jo gate, offline aur delivered states chhod deta hai.

## 16. Questions

**Top 3 abhi poocho:**
1. `app/src/lib/rider.ts` line 33: raat 23:30 ki delivery aur 00:10 ka hand-over, "Cash in hand" zero kyun?
2. `app/src/screens/RiderScreen.tsx` line 50: Delivered slip dikhte waqt naya job aaye to kya rider use dekhta hai?
3. `app/tests/e2e/rider-ink.spec.ts` line 74: axe S6 mein gate, offline aur delivered kyun nahi hain?

<details><summary>Poora question bank</summary>

### Understanding
- `app/src/App.tsx` line 479: jobKitchenId pehle job ka kitchen_id hai; fetchKitchen fail ho (RLS ya offline) to card "The kitchen" bolta hai, chup-chaap. Rider account kitchens table padh sakta hai, kaunsi policy? Ek test is fallback ka?
- `app/src/screens/RiderGate.tsx` line 79: Gate ab children ko function deta hai (name, phone, online, flip, signOut). Demo console me gate null → online switch aur Sign out gayab (by design). Yeh "gate null" raasta kis test me chalta hai?

### Risk
- `app/src/screens/RiderGate.tsx` line 18: getUser fail ho to anonymous true rehta hai → "Sign in to ride", jabki rider asli me signed in ho sakta hai (offline). Gate par phas jayega? Error line alag se dikhti hai ya nahi?
- `app/src/screens/RiderScreen.tsx` line 99: "Not delivered" chhota text button, bina confirm. Galti se tap ho to riderActions ka teesra action kya karta hai (status cancelled, ya sirf event)? Forget me jaisa "Sure?" chahiye?

### Assumptions
- `app/src/lib/rider.ts` line 34: cashInHand: paid_by khali ya "cash" = cash. Aaj sab cash hai. Kal UPI aaya to paid_by "upi" se yeh line theek rahegi, par "Collect cash" aur "Cash collected" copy nahi. Woh switch kahan lagega?

### Purpose
- `app/src/lib/rider.ts` line 32: firstName fallback "customer": "Call customer", "Arriving · tell customer". Naam na ho to board kya bolta hai? Pilot me naam hamesha hoga (bill par zaroori)?
- `app/src/ui/index.tsx` line 117: Tabs generic (rider, kitchen) aur customer ka TabBar alag. Do tab components kyun? TabBar ko Tabs par le jaana ek line hai, ya "My orders"/"Account" aria-labels tootenge?

### Alternatives
- `app/src/screens/RiderGate.tsx` line 42: lockup-day.png Night me bhi (F145.7). Customer welcome par Night me kya hai? Agar `lockup-night.png` hai to yahan bhi theme se chuno, ek line.

### Testability
- `app/src/screens/RiderScreen.tsx` line 93: "N more waiting": riderOrders ka order kya hai (created_at, ya jaise aaye)? Do ready orders par kaunsa pehle job banta hai, aur kya test hai?
- `app/src/ui/ui.css` line 310: badge `right: calc(50% - 22px)`: label ki chaudai se bandha. "New" aur "Cooking" par badge alag jagah baithega? Shot me dikha?
- `app/tests/e2e/rider-ink.spec.ts` line 28: S2: "₹640" count 2 (total + ek row). Do rows same total → count 3, test fail. Row ko testid ya "Cash in hand" ke paas ka total alag se assert?
- `app/tests/e2e/rider-ink.spec.ts` line 74: S6 axe sirf Job (job ke saath), Today, Me. R3 offline, R7 delivered, R1/R2 gate scan ke bahar. Night me gate (lockup-day) ka contrast kahan check hua? Teen states aur jodo?

### Future
- `app/src/screens/RiderScreen.tsx` line 108: "shares your location every 30 seconds" hard copy hai; LOCATION_EVERY_MS se nahi juda. Clock chip wala drift yahan bhi: 9e35759 jaisa ek label function?
- `docs/follow-ups.md` line 151: F145 saat deviations, reviewer ka jawab: (1) pin line nahi, theek; (2) raw phone, theek; (3) Rides for nahi, theek; (4) Not delivered rakho, par confirm ke saath; (5) last ping time baad me; (6) early minutes nahi; (7) Night me night lockup lo agar file hai. Haan ya kuch alag?

### Impact
- `app/src/screens/RiderScreen.tsx` line 133: "Cash in hand · Hand over at the kitchen tonight": kitchen ke Kitchen tab par "₹X on the slips" (#223) alag number ho sakta hai (kitchen sab delivered, rider sirf apna cash). Do screens, do numbers: hisaab milane ka flow kis story me?

</details>

## 17. Self-check (light, 2-3)
1. Cash in hand kis ghadi se ginta hai? Agar 23:30 ki delivery aur 00:10 ka hand-over ho, to rider ke screen par kya dikhega?
2. Agar getUser fail ho, to gate par rider ko kya dikhta hai? Kya woh sach hai?
3. Delivered slip dikh raha hai aur naya job aa gaya. Rider ko kya dikhta hai, aur kab?

## Inline comments

Har comment ek teaching question hai. Status: sab open.

<!-- gh-comment-id: 4367921133 -->
- **File:** `app/src/App.tsx` · **Line:** 479 · **Category:** Understanding
- **Question:** jobKitchenId pehle job ka kitchen_id hai; fetchKitchen fail ho (RLS ya offline) to card "The kitchen" bolta hai, chup-chaap. Rider account kitchens table padh sakta hai, kaunsi policy? Ek test is fallback ka?
- **Status:** open

<!-- gh-comment-id: 4367921135 -->
- **File:** `app/src/lib/rider.ts` · **Line:** 33 · **Category:** TOP · Risk
- **Question:** deliveredToday phone ki local date se ginta hai. 23:30 ki delivery aur 00:10 par hand-over: "Cash in hand" zero dikhega jabki cash haath me hai. "Hand over tonight" ke saath yeh ulta pad sakta hai. Din ko kitchen ke closes_at ya "last hand-over" se baandhein?
- **Status:** open

<!-- gh-comment-id: 4367921141 -->
- **File:** `app/src/lib/rider.ts` · **Line:** 34 · **Category:** Assumptions
- **Question:** cashInHand: paid_by khali ya "cash" = cash. Aaj sab cash hai. Kal UPI aaya to paid_by "upi" se yeh line theek rahegi, par "Collect cash" aur "Cash collected" copy nahi. Woh switch kahan lagega?
- **Status:** open

<!-- gh-comment-id: 4367921144 -->
- **File:** `app/src/lib/rider.ts` · **Line:** 32 · **Category:** Purpose
- **Question:** firstName fallback "customer": "Call customer", "Arriving · tell customer". Naam na ho to board kya bolta hai? Pilot me naam hamesha hoga (bill par zaroori)?
- **Status:** open

<!-- gh-comment-id: 4367921148 -->
- **File:** `app/src/screens/RiderGate.tsx` · **Line:** 18 · **Category:** Risk
- **Question:** getUser fail ho to anonymous true rehta hai → "Sign in to ride", jabki rider asli me signed in ho sakta hai (offline). Gate par phas jayega? Error line alag se dikhti hai ya nahi?
- **Status:** open

<!-- gh-comment-id: 4367921152 -->
- **File:** `app/src/screens/RiderGate.tsx` · **Line:** 42 · **Category:** Alternatives
- **Question:** lockup-day.png Night me bhi (F145.7). Customer welcome par Night me kya hai? Agar `lockup-night.png` hai to yahan bhi theme se chuno, ek line.
- **Status:** open

<!-- gh-comment-id: 4367921156 -->
- **File:** `app/src/screens/RiderGate.tsx` · **Line:** 79 · **Category:** Understanding
- **Question:** Gate ab children ko function deta hai (name, phone, online, flip, signOut). Demo console me gate null → online switch aur Sign out gayab (by design). Yeh "gate null" raasta kis test me chalta hai?
- **Status:** open

<!-- gh-comment-id: 4367921157 -->
- **File:** `app/src/screens/RiderScreen.tsx` · **Line:** 50 · **Category:** TOP · Assumptions
- **Question:** done (R7) job se pehle check hota hai: Delivered slip dikhte waqt naya job aaye to rider use "Next delivery" tak nahi dekhega. Reload par doneId gayab, seedha naya job. Dono sahi hain? Board R7 kya kehta hai jab agla job ready ho?
- **Status:** open

<!-- gh-comment-id: 4367921160 -->
- **File:** `app/src/screens/RiderScreen.tsx` · **Line:** 99 · **Category:** Risk
- **Question:** "Not delivered" chhota text button, bina confirm. Galti se tap ho to riderActions ka teesra action kya karta hai (status cancelled, ya sirf event)? Forget me jaisa "Sure?" chahiye?
- **Status:** open

<!-- gh-comment-id: 4367921164 -->
- **File:** `app/src/screens/RiderScreen.tsx` · **Line:** 93 · **Category:** Testability
- **Question:** "N more waiting": riderOrders ka order kya hai (created_at, ya jaise aaye)? Do ready orders par kaunsa pehle job banta hai, aur kya test hai?
- **Status:** open

<!-- gh-comment-id: 4367921170 -->
- **File:** `app/src/screens/RiderScreen.tsx` · **Line:** 108 · **Category:** Future
- **Question:** "shares your location every 30 seconds" hard copy hai; LOCATION_EVERY_MS se nahi juda. Clock chip wala drift yahan bhi: 9e35759 jaisa ek label function?
- **Status:** open

<!-- gh-comment-id: 4367921176 -->
- **File:** `app/src/screens/RiderScreen.tsx` · **Line:** 133 · **Category:** Impact
- **Question:** "Cash in hand · Hand over at the kitchen tonight": kitchen ke Kitchen tab par "₹X on the slips" (#223) alag number ho sakta hai (kitchen sab delivered, rider sirf apna cash). Do screens, do numbers: hisaab milane ka flow kis story me?
- **Status:** open

<!-- gh-comment-id: 4367921178 -->
- **File:** `app/src/ui/index.tsx` · **Line:** 117 · **Category:** Purpose
- **Question:** Tabs generic (rider, kitchen) aur customer ka TabBar alag. Do tab components kyun? TabBar ko Tabs par le jaana ek line hai, ya "My orders"/"Account" aria-labels tootenge?
- **Status:** open

<!-- gh-comment-id: 4367921179 -->
- **File:** `app/src/ui/ui.css` · **Line:** 310 · **Category:** Testability
- **Question:** badge `right: calc(50% - 22px)`: label ki chaudai se bandha. "New" aur "Cooking" par badge alag jagah baithega? Shot me dikha?
- **Status:** open

<!-- gh-comment-id: 4367921183 -->
- **File:** `app/tests/e2e/rider-ink.spec.ts` · **Line:** 28 · **Category:** Testability
- **Question:** S2: "₹640" count 2 (total + ek row). Do rows same total → count 3, test fail. Row ko testid ya "Cash in hand" ke paas ka total alag se assert?
- **Status:** open

<!-- gh-comment-id: 4367921185 -->
- **File:** `app/tests/e2e/rider-ink.spec.ts` · **Line:** 74 · **Category:** TOP · Testability
- **Question:** S6 axe sirf Job (job ke saath), Today, Me. R3 offline, R7 delivered, R1/R2 gate scan ke bahar. Night me gate (lockup-day) ka contrast kahan check hua? Teen states aur jodo?
- **Status:** open

<!-- gh-comment-id: 4367921188 -->
- **File:** `docs/follow-ups.md` · **Line:** 151 · **Category:** Future
- **Question:** F145 saat deviations, reviewer ka jawab: (1) pin line nahi, theek; (2) raw phone, theek; (3) Rides for nahi, theek; (4) Not delivered rakho, par confirm ke saath; (5) last ping time baad me; (6) early minutes nahi; (7) Night me night lockup lo agar file hai. Haan ya kuch alag?
- **Status:** open

## 18. Handoff

State: 0 answered · 0 need-fix · 17 open · actor: coder

```
To coder, from reviewer, re PR #222:
1. Approved on the code. 17 teaching questions inline, 3 TOP (cash in hand resets at midnight; the done slip hides a new job; axe skips the gate and the offline and delivered states). Reply on each in 1-2 sentences; a fix is a commit on this layer.
2. Guard is red on the 75-char subject: after the owner's yes, reword, force push, then run gh stack sync so #223 follows.
3. F145: all seven accepted, except (4) Not delivered needs a confirm and (7) use the night lockup in Night if the file exists.
4. Continue development: #223 threads next, then story #195 "H12 UI rollout: admin" on feat/195-admin-ui from dev after both merge.
Need from you: the sha after the reword and the thread replies.
```

---

## What happened after review
- Review post hua: 5639179226 (APPROVE), 17 inline comments.
- Replies: 0 answered, 17 open.
- Merge: pending. Guard red hai.
