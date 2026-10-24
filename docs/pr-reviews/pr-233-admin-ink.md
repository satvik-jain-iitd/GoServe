# PR #233 — feat(app): Ink v3 admin app, boards A1 to A4 and A8 (#195)

- **Branch:** feat/195-admin-ui → feat/225-day-default-dev (layer 2 on #232) [VERIFIED]
- **Author:** klickbae8yt-star
- **Story / issue:** #195 "H12a" (epic E18, #182). [VERIFIED]
- **Status:** MERGED into a dead base (lost); rebuilt as #234 (feat/195-admin-ui-dev → dev), APPROVE 5639504559, plus the 13 thread fixes in 8fce86f, approved (review 5639435161, APPROVE). [VERIFIED]
- **Files:** 27 (10 png) · **Lines:** +361 / -105 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5639435161 (APPROVE) [VERIFIED]
- **Head:** 9e79a17 [VERIFIED]
- **CI:** Site pass, Guard pass, App pending at read time. [VERIFIED]
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/233

---

> Dhaba ke owner ki counter book ka ek page: aaj ke slips (Live, Done), ek slip jo haath mein uthakar padhi aur call ki gayi, aur din ka hisaab piche ke page par.

---

## Overall review

## 1. Ek-line logline
> `Admin app naye boards par ban gaya: gate, aaj ke orders (Live, Done), ek order ka pura slip, aur din ka hisaab (Numbers). City tab abhi purane tools par hai, H12b tak.`

## 2. Big Picture (Story & Goal)
- Yeh PR story #195 "H12a" ka hissa hai. Epic E18 (#182) ka hissa hai. [VERIFIED]
- Story #195 maangti hai: admin screens boards par dobara bane, aur test ids same rahen. [VERIFIED]
- Boards: A1, A2 (gate, SignIn landing slip ke andar), A3 (orders Live/Done, "Open order <id>, <name>" rows), A4 (ek order: slip, Call customer/kitchen, rider row, Timeline "Order status", Cancel with reason), A8 (Numbers: four tiles aur per kitchen rows, data-testid day-total same). [VERIFIED]
- Admin lock frame hua hai. `/ops/` ko chhua nahi gaya. [VERIFIED]
- Kis role ke liye: admin (dhaba owner). [INFERRED]

## 3. Yeh ab aaya kyun? (Context)
- Yeh PR branch feat/225-day-default-dev ke upar layer 2 hai, #232 ke baad. [VERIFIED]
- Story #195 ne admin ko naye skill par maanga. Is PR mein sirf A1 se A4 aur A8 hain. [VERIFIED]
- City tab purane Kitchens, Staff, Menu tools rakhta hai. Yeh F150 ke tahat accept hua hai. [VERIFIED]
- Pehle wala admin design kaisa tha: brief mein nahi tha.

## 4. Real-Life Analogy
Poori PR ek dhaba ke owner ki counter book hai.
1. Counter book → admin app poori.
2. Book ka cover aur tabs → `app/src/screens/AdminScreen.tsx` (gate, Orders, City, Numbers).
3. Aaj ke slips ka page (Live, Done) → `app/src/screens/AdminOrders.tsx` ki list.
4. Ek slip haath mein uthana aur call karna → A4, ek order ka pura view.
5. Cancel ki stamp, saath mein wajah → Cancel with reason.
6. Piche ka hisaab wala page → `app/src/screens/AdminNumbers.tsx` (A8).
7. Bookkeeper ke niyam → `app/src/lib/admin.ts` (liveOrders, doneOrders, order read).

## 5. Is PR mein naye Concepts (3-6)
Teen concepts, neeche `concepts.delta.md` mein bhi hain.

### Read-once list vs live list
- **Matlab:** List ek baar load hoti hai (aur cancel ke baad phir). Live list apne aap badalti hai.
- **Kyun matter karta hai:** Admin ka "Live" section tap ke bina purana reh jata hai.
- **Real-life link:** Counter book ki subah ki copy vs ghanti wali slip rail.

### One role, one vocabulary
- **Matlab:** Ek state ko har role ka apna naam milta hai.
- **Kyun matter karta hai:** Placed = "New" admin par, "Placed" customer slip par, "New" kitchen par. Ek order, teen naam.
- **Real-life link:** Ek hi slip ko teen staff teen naam se bulate hain.

### Gate landing copied three times
- **Matlab:** Gate wala landing block (lockup, zigzag, kicker, slip, footer) teen jagah likha gaya hai.
- **Kyun matter karta hai:** Ek jagah badlo to baaki do jagah bhi badalni padti hai. Shayad StaffLanding component chahiye.
- **Real-life link:** Cover page teen baar chhapa, ek badlao to teeno reprint.

## 6. High-Level Flow
1. Owner admin app kholta hai. Gate (A1) par sign in hota hai, sign in slip ke andar hai (A2).
2. Gate paas hone par Orders page (A3) aaj ki list ek baar load karta hai. Slips Live aur Done mein bant jate hain.
3. Owner ek row par tap karta hai ("Open order <id>, <name>"). A4 khulta hai: slip, Call customer/kitchen, rider row, Timeline.
4. Cancel chahiye to reason likhkar confirm hota hai. List phir se load hoti hai.
5. Din ka hisaab Numbers (A8) par dikhta hai: four tiles aur per kitchen rows.

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/src/screens/AdminScreen.tsx` | Book ka cover aur tabs: gate (A1, A2), Orders, City, Numbers |
| `app/src/screens/AdminOrders.tsx` | Slips ka page aur ek slip haath mein (A3, A4), cancel stamp ke saath |
| `app/src/screens/AdminNumbers.tsx` | Hisaab wala page (A8) |
| `app/src/lib/admin.ts` | Bookkeeper ke niyam: liveOrders, doneOrders, order read (ab updated_at aur rider_id bhi) |
| `app/src/ui/ui.css` | Rang aur size ke styles; danger styles naye hain, ui-tile-v 28px hard-coded hai |
| `app/tests/e2e/admin-ink.spec.ts` | Checklist ke 6 tests (S1 to S6) |

## 8. Pieces aapas mein kaise baat karte hain
- `AdminScreen.tsx` gate dikhata hai, phir Orders, City, Numbers tabs kholta hai. [VERIFIED]
- `AdminOrders.tsx` orders ki list `admin.ts` se leta hai (listTodayOrders, liveOrders, doneOrders). [VERIFIED]
- `admin.ts` order read mein updated_at aur rider_id laata hai. [VERIFIED]
- `AdminNumbers.tsx` ka data source: brief mein nahi tha.

## 9. Pehle se kya badla
- 27 files (10 png), +361 / -105. [VERIFIED]
- Naye screens: AdminScreen, AdminOrders, AdminNumbers ko Ink boards par badla. [VERIFIED]
- Order read mein updated_at aur rider_id jude. [VERIFIED]
- Tests move hue: admin.spec aur admin-rules.spec (City tab click, A2 copy). Naya admin-ink.spec, 6 tests. [VERIFIED]
- Cancel par reason input upar scroll karta hai, Confirm neeche ki bottom bar mein hai. [VERIFIED]

## 10. Macro Risks & Downstream Impact
- **Live list stale:** Orders ek baar load hote hain (load par, cancel ke baad). Customer aur kitchen `useLiveOrders` se live hain. Admin ka Live bina tap ke purana rehta hai. Bada risk, kyunki owner phone kholke dekhega. [VERIFIED]
- **Shabd alag:** placed = "New" admin par, "Placed" customer par, "New" kitchen par. [VERIFIED]
- **Rider naam nahi:** Rider row par "Rider assigned · On the job" hai, naam nahi (naam #231 mein aayega). [VERIFIED]
- **City purane markup mein:** City tab Ink frame ke andar purana `tickets` markup dikhata hai, H12b tak. [VERIFIED]
- **Rider ka rider_id sab admins ko:** Order read ab rider_id leta hai. Ops app bhi yahi read use karta hai ya nahi: brief mein nahi tha. RLS theek hai ya nahi: brief mein nahi tha.
- **onCount effect:** Parent state har count badalne par set hota hai. Render loop tabhi jab callback identity badle, par wo useCallback hai. Theek hai. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Rider naam nahi: #231 ka kaam hai. [VERIFIED]
- City abhi Ink par nahi: H12b (A5 to A7) ke saath aayega. [VERIFIED]
- Realtime ya poll nahi: Orders ek baar padhte hain. [VERIFIED]
- `/ops/` nahi chhuya. [VERIFIED]
- StaffLanding component nahi bana: teen copy abhi hain (question 5 dekho). [VERIFIED]
- canCancel sirf placed aur accepted par (B3 rule). [VERIFIED]

## 12. Testing Story
- Red run paste hua hai. [VERIFIED]
- admin-ink.spec, 6 tests:
  - S1: gate A1, A2.
  - S2: Live aur Done, plus A4 slip, calls, timeline.
  - S3: cancel with reason.
  - S4: Numbers tiles aur per kitchen.
  - S5: City purane tools rakhta hai.
  - S6: axe scan day aur night, A3, A4, A8, A2 par. A1 par nahi. [VERIFIED]
- CI: App pending tha jab brief likha gaya. [VERIFIED]

## 13. Trade-offs & Alternatives
- Brief mein nahi tha, kaunse options the. Ek khula sawaal: StaffLanding component abhi ya H12b mein (Question 5).

## 14. Patterns is PR se
- **Ek screen, ek file:** cover, slips page, totals page alag files mein. Brief ke zone map mein dikhta hai. [VERIFIED]
- **Bookkeeper file:** `admin.ts` mein reads rakhe, screen mein nahi. [VERIFIED]
- **Test as checklist:** S1 se S6, har test ek board ya ek story-line par. [VERIFIED]
- **Scan per screen:** axe S6 har board par chalta hai (A1 chhod kar). [VERIFIED]

## 15. AI-Review Lens
- **Trust karna safe:** test ids same hain, A4 cancel rule (canCancel) sahi likha hai, red run paste hai. [VERIFIED]
- **Confident-but-risky:** Live list dekhne mein live lagti hai, par ek baar load hoti hai. [VERIFIED]
- **Silent words:** placed ke teen naam. Ek hi state, teen bhasha. [VERIFIED]
- **Silent assumption:** Cooking shuru hone ke baad owner app se cancel nahi kar sakta. Kitchen ko call karna hai ya nahi, board A4 kya kehta hai: brief mein nahi tha.
- **Poochne wale sawaal:** Service down ho ya network slow ho to admin kya dekhega: brief mein nahi tha.

## 16. Questions
- **Top 3 abhi poocho:**
  1. TOP · Risk: Orders ek baar padhte hain. Live stale hai. Kya useLiveOrders ya 30 s poll lagana kitna bada kaam hai?
  2. WORD: placed ke teen naam. Jaan-boojh kar hai, ya ek jagah se aana chahiye?
  3. canCancel: cooking ke baad owner cancel nahi kar sakta. Kitchen ko call, ya board A4 kya kehta hai?

<details><summary>Poora question bank</summary>

### Purpose
- `app/src/ui/ui.css` line 330: ui-tile-v 28px hard hai, token nahi (--gs-text-staff jaisa). Numbers ke tiles ka size kis token se aana chahiye?

### Understanding
- `app/src/screens/AdminOrders.tsx` line 10: WORD: placed = "New" admin par, customer slip par "Placed", kitchen par bhi "New". Ek order, teen naam ek hi state ke. Jaan-boojh kar (har role ki apni bhasha) ya ek jagah se aana chahiye?

### Assumptions
- `app/src/screens/AdminOrders.tsx` line 48: canCancel sirf placed/accepted (B3 rule). Cooking shuru hone ke baad owner cancel nahi kar sakta app se; ab kya karega, kitchen ko call? Board A4 kya kehta hai?

### Risk
- `app/src/screens/AdminOrders.tsx` line 26 (TOP): Orders ek baar padhte hain (load par, cancel ke baad). Customer aur kitchen useLiveOrders se live hain; admin ka "Live" section bina tap ke purana reh jata hai. Pilot me owner phone kholke dekhega to stale list. useLiveOrders yahan bhi lagana kitna bada kaam hai, ya 30 s poll?

### Alternatives
- `app/src/screens/AdminScreen.tsx` line 50: Gate ka landing block ab teen jagah copy hai (RiderGate, KitchenGate, AdminScreen): lockup, zigzag, kicker, slip, footer. Ek `StaffLanding` component ek line ka kaam hai; H12b me ya abhi?

### Impact
- `app/src/lib/admin.ts` line 112: Order read ab updated_at aur rider_id bhi lata hai. Ops app bhi yahi read use karta hai? Ek column aur = sab admins ko sab orders ka rider_id; RLS me theek?

### Testability
- `app/tests/e2e/admin-ink.spec.ts` line 103: S6 axe A3, A4, A8, A2 scan karta hai; A1 (Sign in to run the city) nahi. Rider/kitchen me R1/K1 scan hote hain. Ek line aur?

### Future
- `app/src/screens/AdminOrders.tsx` line 75: "Rider assigned · On the job" bina naam ke. #231 rider naam laayega; tab tak owner ko kisko call karna hai pata nahi. Rider ka phone bhi chahiye yahan (F?).
- `docs/follow-ups.md` line 157: F150 chhe deviations: reviewer ka jawab coder ke list par: sab theek jab tak City purane tools par hai; H12b me A5 to A7 ke saath hi City ko Ink par lao, alag se nahi.

</details>

## 17. Handoff (in a fenced block)

State: 9 open · actor: coder

```
To coder, from reviewer, re PR #233:
1. Approved on the code. 9 teaching questions inline, 1 TOP: the admin Orders page is read once, no realtime and no poll, so Live goes stale; say how useLiveOrders or a poll lands (this layer or H12b). Reply in 1-2 sentences each; a fix is a commit on this layer.
2. F150: all six accepted; City moves to Ink with A5 to A7 in H12b.
3. Continue development: H12b "A5 to A7 City on Ink" as the next layer on this branch after the merge; paste the first red run.
Need from you: the replies and the H12b PR number.
```

---

## Inline comments

Har comment ek teaching question hai. Status: sab open.

<!-- gh-comment-id: 4368077324 -->
- **File:** `app/src/screens/AdminOrders.tsx` · **Line:** 26 · **Category:** TOP · Risk
- **Question:** Orders ek baar padhte hain (load par, cancel ke baad). Customer aur kitchen useLiveOrders se live hain; admin ka "Live" section bina tap ke purana reh jata hai. Pilot me owner phone kholke dekhega to stale list. useLiveOrders yahan bhi lagana kitna bada kaam hai, ya 30 s poll?
- **Reply (klickbae8yt-star):** Fixed in 8fce86f (PR #234, the rebuild from dev): the admin list reloads every 30 s (`POLL_MS`) and whenever the app comes back to the foreground (visibilitychange). useLiveOrders is scoped to one session, kitchen or rider; the all-kitchens
- **Status:** fixed 8fce86f (#234), resolved 25 Oct

<!-- gh-comment-id: 4368077326 -->
- **File:** `app/src/screens/AdminOrders.tsx` · **Line:** 10 · **Category:** Understanding
- **Question:** WORD: placed = "New" admin par, customer slip par "Placed", kitchen par bhi "New". Ek order, teen naam ek hi state ke. Jaan-boojh kar (har role ki apni bhasha) ya ek jagah se aana chahiye?
- **Reply (klickbae8yt-star):** On purpose (each role's words), from one place now: `staffLabel(status)` in lib/kitchen gives "New" for placed on the kitchen and admin apps, `statusLabel` gives the customer "Placed". Both screens read it (8fce86f (PR #234, the rebuild fro
- **Status:** fixed 8fce86f (#234), resolved 25 Oct

<!-- gh-comment-id: 4368077328 -->
- **File:** `app/src/screens/AdminOrders.tsx` · **Line:** 75 · **Category:** Future
- **Question:** "Rider assigned · On the job" bina naam ke. #231 rider naam laayega; tab tak owner ko kisko call karna hai pata nahi. Rider ka phone bhi chahiye yahan (F?).
- **Reply (klickbae8yt-star):** F151: join riders on rider_id (with #231) and add the rider's call row on A4. Until then the Call block has the customer and the kitchen; the kitchen knows who picked up.
- **Status:** answered, resolved 25 Oct

<!-- gh-comment-id: 4368077332 -->
- **File:** `app/src/screens/AdminOrders.tsx` · **Line:** 48 · **Category:** Assumptions
- **Question:** canCancel sirf placed/accepted (B3 rule). Cooking shuru hone ke baad owner cancel nahi kar sakta app se; ab kya karega, kitchen ko call? Board A4 kya kehta hai?
- **Reply (klickbae8yt-star):** Rule B3 (owner): a cancel is only at New or Accepted; once the pan is on, the owner calls the kitchen from the Call block right above. The board shows Cancel on a Cooking order, so this is F150 (7) for the owner to confirm or change.
- **Status:** answered, resolved 25 Oct

<!-- gh-comment-id: 4368077335 -->
- **File:** `app/tests/e2e/admin-ink.spec.ts` · **Line:** 103 · **Category:** Testability
- **Question:** S6 axe A3, A4, A8, A2 scan karta hai; A1 (Sign in to run the city) nahi. Rider/kitchen me R1/K1 scan hote hain. Ek line aur?
- **Reply (klickbae8yt-star):** Fixed in 8fce86f (PR #234, the rebuild from dev): S6 scans A1 too (Sign in to run the city), Day and Night.
- **Status:** fixed 8fce86f (#234), resolved 25 Oct

<!-- gh-comment-id: 4368077337 -->
- **File:** `app/src/screens/AdminScreen.tsx` · **Line:** 50 · **Category:** Alternatives
- **Question:** Gate ka landing block ab teen jagah copy hai (RiderGate, KitchenGate, AdminScreen): lockup, zigzag, kicker, slip, footer. Ek `StaffLanding` component ek line ka kaam hai; H12b me ya abhi?
- **Reply (klickbae8yt-star):** Fixed in 8fce86f (PR #234, the rebuild from dev): `StaffLanding` in ui (lockup, zigzag, kicker, slip head, footer); RiderGate, KitchenGate and AdminScreen pass their words and the slip body. Rider and kitchen specs unchanged and green.
- **Status:** fixed 8fce86f (#234), resolved 25 Oct

<!-- gh-comment-id: 4368077341 -->
- **File:** `app/src/ui/ui.css` · **Line:** 330 · **Category:** Purpose
- **Question:** ui-tile-v 28px hard hai, token nahi (--gs-text-staff jaisa). Numbers ke tiles ka size kis token se aana chahiye?
- **Reply (klickbae8yt-star):** Fixed in 8fce86f (PR #234, the rebuild from dev): `--gs-number-xl: 28px` in tokens.css drives `.ui-tile-v`.
- **Status:** fixed 8fce86f (#234), resolved 25 Oct

<!-- gh-comment-id: 4368077344 -->
- **File:** `app/src/lib/admin.ts` · **Line:** 112 · **Category:** Impact
- **Question:** Order read ab updated_at aur rider_id bhi lata hai. Ops app bhi yahi read use karta hai? Ek column aur = sab admins ko sab orders ka rider_id; RLS me theek?
- **Reply (klickbae8yt-star):** The Ops app does not use listTodayOrders (it reads the live list and day_numbers). RLS is row level: `admin_read on orders using (is_admin())` already gives an admin every column of every order, rider_id included, so the extra columns chang
- **Status:** answered, resolved 25 Oct

<!-- gh-comment-id: 4368077346 -->
- **File:** `docs/follow-ups.md` · **Line:** 157 · **Category:** Future
- **Question:** F150 chhe deviations: reviewer ka jawab coder ke list par: sab theek jab tak City purane tools par hai; H12b me A5 to A7 ke saath hi City ko Ink par lao, alag se nahi.
- **Reply (klickbae8yt-star):** Agreed: City stays on the old tools until H12b brings A5 to A7 together, on top of #234. F150 row says so.
- **Status:** answered, resolved 25 Oct
