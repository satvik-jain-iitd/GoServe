# PR #223 — feat(app): Ink v3 kitchen app, boards K1 to K6 (#194)

- **Branch:** feat/194-kitchen-ui → feat/194-rider-kitchen-ui (layer 2 on #222)
- **Author:** klickbae8yt-star
- **Story / issue:** #194 "H11 UI rollout: rider and kitchen" (epic E18, #182). Layer 2 of 2.
- **Status:** MERGED, approved (review 5639174623, APPROVE). Merge right after #222. [VERIFIED]
- **Files:** 38 (14 png) · **Lines:** +471 / -148 [VERIFIED]
- **Reviewer:** satvik-jain-iitd · review 5639174623 (APPROVE) [VERIFIED]
- **Head:** be32bc1 [VERIFIED]
- **CI:** Guard pass, App pass, Site pass [VERIFIED]
- **Link:** https://github.com/satvik-jain-iitd/GoServe/pull/223

---

> Dhaba ki kitchen mein ticket rail hai. Naye order par ticket New mein lagta hai, cook use Cooking mein le jaata hai, aur packed food Ready ke pass par wait karta hai.

---

## Overall review

## 1. Ek-line logline
> `Kitchen app naye boards par ban gaya: New, Cooking, Kitchen. Ticket ek list se teen filter mein bant jaate hain. Switch aur dish list ab naye look mein hain. Ek default "open" unknown state ko chhupata hai.`

## 2. Big Picture (Story & Goal)
- Yeh PR story #194 "H11 UI rollout: rider and kitchen" ka kitchen wala hissa hai. Epic E18 (#182) ka hissa hai. [VERIFIED]
- Story #194 ke kitchen half ke liye: tickets K1 se K6 tak naye boards par. Test ids aur aria-labels same rahe. [VERIFIED]
- Words boards par gaye hain: "No. <id>", "2 × Butter Chicken", heading New, switch "Open for orders" (pehle "Close kitchen"). [VERIFIED]
- Extra: KitchenTools bana DishList. deliveredToday aur hhmm lib/kitchen mein gaye. Gate kitchen row aur open switch rakhta hai. [VERIFIED]
- Deviation F146: 18 px type aur 56 px Accept, story D3 ("wet hands") ki wajah se. [VERIFIED]

## 3. Yeh ab aaya kyun? (Context)
- Story #194 ne kitchen ko naye skill par maanga. Yeh PR kitchen wala aadha hissa hai. [VERIFIED]
- #222 (rider) is PR ke neeche stack hai. GitHub layers ko rebase karega, aur approval rahegi agar code nahi badla. [VERIFIED]
- Kitchen ke pehle wale design ki detail is brief mein nahi thi.
- Next story #195 "H12 UI rollout: admin" (epic #182) hai. Yeh independent hai, kyunki sirf admin screens chhooti hai. [VERIFIED]

## 4. Real-Life Analogy
Poori PR ek dhaba ki kitchen hai. Ticket rail par order lagte hain, stove par cook karte hain, aur pass par packed food rider ka wait karta hai.

1. `app/src/screens/KitchenGate.tsx` = kitchen ka darwaza. Google face check (K1), "kitchen staff nahi" (K2), aur darwaze par open/closed ka board.
2. `app/src/screens/KitchenScreen.tsx` = rail, stove aur pass. New tickets (Accept), Cooking (Start aur Ready), Ready (rider ka wait), ek ticket haath mein (K4), switchboard tab (K5).
3. `app/src/screens/KitchenTools.tsx` (DishList) = dishes ka chalkboard, category ke hisaab se, "sold out" chalk ke saath.
4. `app/src/lib/kitchen.ts` = rail ke sorting rules: newTickets, cookingTickets, readyTickets, sab oldest pehle. Saath mein deliveredToday aur hhmm.
5. `app/src/App.tsx` = manager. Kitchen app ko frame karta hai, gate state screen ko deta hai.
6. `app/tests/e2e/kitchen-ink.spec.ts` = inspector jo K1 se K6 tak Day aur Night mein check karta hai.

## 5. Is PR mein naye Concepts (3-6)

### Ticket buckets
- **Naam:** Ticket buckets
- **Matlab:** Orders ki ek list, aur teen pure filters: new, cooking, ready. Har bucket oldest pehle sort hota hai.
- **Kyun matter karta hai:** Cook ko pata hai ki sabse purana ticket pehle banega. Teen filter ke unit tests bhi hain.
- **Real-life link:** Rail, stove, pass. Sabse purana ticket pehle uthta hai.

### Gate holds the switch
- **Naam:** Gate holds the switch
- **Matlab:** Open/closed state aur uska rpc gate mein hai. Screen sirf use dikhati hai.
- **Kyun matter karta hai:** Kitchen tab aur header ko `open` aur `closes_at` chahiye. Switch ek hi jagah se badalta hai.
- **Real-life link:** Darwaze ka board andar se cook palta hai, screen sirf dekhti hai.

### Ek ticket over the tabs
- **Naam:** One ticket over the tabs (K4)
- **Matlab:** K4 poori screen ko ek ticket se badal deta hai, Back ke saath. Router nahi hai.
- **Kyun matter karta hai:** Koi router nahi hai (#48 se). Back button ka history nahi hai.
- **Real-life link:** Cook ek ticket rail se utaar kar paas se padhta hai.

### 18 px aur 56 px (D3 ki wajah se)
- **Naam:** Bada type aur bada Accept (F146.1)
- **Matlab:** Ticket lines 18 px, Accept button 56 px. Story D3 "wet hands" kehti hai.
- **Kyun matter karta hai:** Cook geele haath se button dabata hai. Chhota button galat tap karwata hai.
- **Real-life link:** Dhaba ka menu board naqsha se bada banaya jaata hai, kyunki cook do meter door khada hai.

### Copy as a promise
- **Naam:** Copy as a promise
- **Matlab:** "New tickets ring · accept within 2 min" ek vaada karta hai. Screen ko woh nibhana chahiye.
- **Kyun matter karta hai:** Is diff mein audio nahi hai. Push hai (enablePush), par ring ka code nahi.
- **Real-life link:** "Ghanti bajti hai" likha ho to ghanti honi chahiye.

## 6. High-Level Flow
1. `/kitchen/` par KitchenGate chalta hai: session, getUser, myKitchen, kitchens row. Phir K1, K2, ya app.
2. New tab: newTickets (placed) oldest pehle. Badge count dikhata hai. Accept (status accepted) par ticket New se chala jata hai. K4 se Accept ho to tab Cooking par jump karta hai.
3. Cooking: Start (preparing), Ready (ready). Ready tickets "Ready · rider on the way" ke neeche wait karte hain.
4. Kitchen tab: aaj ka done count aur slip total, "Open for orders" switch (rpc), dishes category ke hisaab se, Sold out, Sign out.

## 7. The Cast (Files ka role)

| File | Role |
|---|---|
| `app/src/screens/KitchenGate.tsx` | Darwaza: getUser (anonymous), myKitchen, kitchens row (name, open, closes_at). K1, K2, flipOpen (rpc set_kitchen_open). Children ko state function ke through deta hai. |
| `app/src/screens/KitchenScreen.tsx` | Tabs New, Cooking, Kitchen. Har ticket par Open ticket aur step button. K4 ek ticket Back ke saath. "No new tickets" aur aaj ka count. Kitchen tab par switch, DishList, Sign out. |
| `app/src/screens/KitchenTools.tsx` | DishList: dishes category ke hisaab se, VegMark, Sold out / Back in stock. |
| `app/src/lib/kitchen.ts` | newTickets, cookingTickets, readyTickets (oldest pehle), Done type, deliveredToday, hhmm, hhmmOf. |
| `app/src/lib/rider.ts` | deliveredToday aur hhmm yahan se nikal ke kitchen mein gaye. `import type { Done }` beech mein hai. |
| `app/src/App.tsx` | kitchenScreen(gate), kitchen lock ke liye frame, SignIn frame mein chhup jata hai. |
| `app/src/ui/ui.css` | Ticket rules, .ui-ticket-big (18px), .ui-group, .ui-btn.small. |
| `app/tests/e2e/kitchen-ink.spec.ts` | Naya test: S1 new ticket se Cooking, S2 Cooking aur Ready, S3 quiet state aur count, S4 Kitchen tab, S5 not staff, S6 sign in to cook, S7 axe Day aur Night. |
| `app/tests/unit/kitchen.test.ts` | Ticket buckets ke do unit tests. |
| Moved tests (apps, autopilot, feedback, kitchen-account, kitchen-controls, kitchen.spec, split, staff-gate, staff-ui, shots) | Labels, headings aur tab naam naye boards ke hisaab se. |
| `docs/follow-ups.md`, LEARNINGS, trace, test-cases | F146 (6 deviations), 4 LEARNINGS rows, trace row, test-cases row. |

## 8. Pieces aapas mein kaise baat karte hain
- `App.tsx` kitchen gate ko call karta hai. Gate `KitchenScreen` ko kitchenId, name, open, closesAt, flipOpen, signOut function ke through deta hai.
- `KitchenScreen` `lib/kitchen.ts` ke filters se tickets leta hai.
- `KitchenScreen` `KitchenTools` (DishList) ko kitchenId deta hai, Kitchen tab ke andar.
- `lib/rider.ts` ab sirf kitchen se function nahi leta. Woh #222 se aaya hai, aur is PR mein do lines badli hain.
- `ui/index.tsx` ka Tabs component #222 ka hai. Kitchen usi ko use karta hai.

## 9. Pehle se kya badla
- Total: 38 files (14 png). +471 / -148. [VERIFIED]
- App code: KitchenGate (+66/-7), KitchenScreen (+119/-32), KitchenTools (+24/-46), kitchen.ts (+15), rider.ts (+1/-6), App.tsx (+10/-10), ui.css (+13). [VERIFIED]
- Naye tests: kitchen-ink.spec.ts (+90), kitchen.test.ts (+16). [VERIFIED]
- Moved tests ke headings, tab naam aur poll badle. Test ids aur aria-labels same rahe. [VERIFIED]

## 10. Macro Risks & Downstream Impact
- **Unknown ko "open" dikhana (bada):** `r?.open !== false` ka matlab hai row na padh paane par switch "Open" dikhata hai. Cook ko pata nahi ki asli state kya hai. [VERIFIED]
- **Copy ka vaada (bada):** "New tickets ring" likha hai, par ring ka audio is diff mein nahi hai. Push hai, par sound nahi. [VERIFIED copy; INFERRED no sound]
- **VegMark default (bada):** `d.veg` undefined ho to dish veg maani jaati hai. Agar listDishes mein veg select nahi hai, to har dish par hari mark dikhegi. [INFERRED]
- **Do behaviour, ek tap (medium):** Accept list se ho to ticket New se gayab, tab New hi rehta hai. K4 se ho to Cooking tab khulta hai. [VERIFIED]
- **Label galat (chhota):** "Back to new tickets" aria-label Cooking se khule ticket par bhi hai. Neeche wala button "Back to cooking" sahi bolta hai. [VERIFIED]
- **22:00 ka vaada (medium):** "Till 22:00 · customers see closed the moment you switch off". 22:01 par switch on ho to kya hota hai, yeh is diff mein nahi hai. [INFERRED]
- **Do numbers (medium):** Kitchen ka "on the slips" sab delivered totals ginta hai. Rider ka "Cash in hand" sirf apna cash. Do numbers ho sakte hain. [VERIFIED]
- **Cancelled orders:** kitchen par kabhi nahi dikhte (WITH_RIDER, pehle jaisa). [VERIFIED]
- **Import ki jagah (chhota):** `import type { Done }` rider.ts mein code ke beech mein hai. [VERIFIED]

## 11. Jo jaan-boojh kar NAHI hai (Scope)
- Note field, rider ka naam ready ticket par, console controls. Reason: F146. [VERIFIED]
- Ring sound. Reason: push hi hai, is story mein audio nahi. [VERIFIED]
- Night shots. Reason: file cap. [VERIFIED]
- K4 ke liye route. Reason: #48 se router nahi hai. [VERIFIED]

## 12. Testing Story
- Red-first proof PR body mein paste hai. Chaar failures quote hain: "New" heading, Cooking tab, "No new tickets", Kitchen tab nahi mila. [VERIFIED]
- Counts: 230 unit, 219 e2e (coder ka count). [INFERRED]
- kitchen-ink S1 se S7. Unit tests ticket buckets ke liye. Moved tests "Accept 0f0f0f0f", "Start 0f0f0f0f", "Mark Butter Chicken sold out" rakhte hain. [VERIFIED]
- S7 axe sirf New, Cooking, Kitchen scan karta hai. K4 ticket aur K1, K2 gate scan nahi hote. [VERIFIED]
- Badge zero case assert nahi hai (badge zero par chhup jata hai). [VERIFIED]
- Shots: K screens sirf Day mein. [VERIFIED]

## 13. Trade-offs & Alternatives

| Choice | Kyun | Kya chhoda |
|---|---|---|
| Gate kitchen row rakhta hai | Kitchen tab aur header ko open aur closes_at chahiye | KitchenTools ke paas switch |
| K4 tabs ke upar | Router nahi hai | Back button ki history |
| 18 px aur 56 px | D3 ("wet hands") | K3 par board jaisa fidelity |

## 14. Patterns is PR se
- **Pure filters:** ek list, teen filter, har ek pure function. kitchen.ts.
- **Gate holds state:** open switch aur rpc gate mein. KitchenGate.tsx.
- **Overlay screen:** K4 ek ticket ko poori screen par le aata hai. KitchenScreen.tsx.
- **Test contract:** aria-labels aur test ids same, taaki purane tests chalein. Moved tests.

## 15. AI-Review Lens
- **Trust karo:** har purana aria-label mil jata hai. Buckets pure functions hain, unit tests ke saath. Red run paste hai. [VERIFIED]
- **Interrogate karo:** default jo unknown ko chhupata hai (open = true). Copy jo sound ka vaada karta hai. Veg mark jo default veg hai. Ek Accept ke do behaviour.

## 16. Questions

**Top 3 abhi poocho:**
1. `app/src/screens/KitchenGate.tsx` line 24: kitchens row na padh paane par switch "Open" kyun dikhta hai?
2. `app/src/screens/KitchenScreen.tsx` line 99: "New tickets ring" wala ring kahan hai?
3. `app/src/screens/KitchenTools.tsx` line 29: VegMark default veg kyun hai?

<details><summary>Poora question bank</summary>

### Understanding
- `app/src/lib/kitchen.ts` line 29: newTickets sirf placed; accepted + preparing Cooking; ready alag; cancelled kahin nahi (WITH_RIDER, pehle jaisa). Cook ne Start kar diya aur customer ne cancel kiya to ticket chup-chaap gayab: cook ko batana nahi chahiye?
- `app/src/screens/KitchenGate.tsx` line 61: flipOpen rpc ke baad local row badalta hai. Customer side "closed" realtime se dekhta hai ya agle menu read par? Copy "the moment you switch off" kehti hai: kaunsa test yeh proof deta hai?

### Risk
- `app/src/screens/KitchenGate.tsx` line 24: kitchens row na padh paye to open = true default. Switch "Open" dikhayega jabki asli state pata nahi; cook sochega sab theek hai. Unknown ko unknown dikhao (switch disabled + "could not read the kitchen")?
- `app/src/screens/KitchenScreen.tsx` line 30: Accept list se → ticket New se gayab, tab New hi rehta hai (cook khud Cooking khole). K4 se Accept → Cooking tab. Ek tap, do behaviour. Board kya kehta hai? Dono me Cooking par jaana saaf hota?
- `app/src/screens/KitchenTools.tsx` line 29: VegMark veg = d.veg !== false: listDishes ke select me `veg` nahi hai to sab dish hari dikhegi (non-veg bhi). Select me veg hai? Ek unit test non-veg ka?

### Assumptions
- `app/src/screens/KitchenScreen.tsx` line 99: "New tickets ring · accept within 2 min": ring hai kya? Is diff me audio nahi, push hai (enablePush). Copy ek vaada hai jo screen nahi nibhati. Ring kis story me, ya copy badlo?

### Purpose
- `app/src/screens/KitchenTools.tsx` line 20: Category groups ka order = jis order me dishes aaye. Customer menu ka category order yahi hai? Cook aur customer alag order dekhein to "Thali" dhoondhna mushkil.
- `app/src/lib/rider.ts` line 31: `import type { Done }` file ke beech me, code ke baad. Lint nahi rokta? Upar le jao, ek line.

### Alternatives
- `app/src/ui/ui.css` line 318: 18 px lines aur 56 px Accept (F146.1, D3 wet hands): haan, D3 board se jeet-ta hai. Token banao (`--gs-text-kitchen`, `--gs-tap-kitchen`) taaki rider ka Picked up bhi wahi le?

### Testability
- `app/src/screens/KitchenScreen.tsx` line 59: aria-label "Back to new tickets" Cooking se khole ticket par bhi; neeche ka button sahi bolta hai ("Back to cooking"). Label ko bhi tab se baandho.
- `app/src/screens/KitchenScreen.tsx` line 24: onSlips = aaj ke sab delivered ka total; rider ka "Cash in hand" sirf apna cash. Do screens, do numbers. Raat ko hisaab milane ka flow (kitchen vs rider) kis story me? Ek line F me likho.
- `app/tests/e2e/kitchen-ink.spec.ts` line 9: S1 badge "1 new" getByLabel. Zero par badge nahi (falsy). S3 quiet state me badge absent assert karo, warna "0 new" kabhi aa jaye to pata nahi chalega.
- `app/tests/e2e/kitchen-ink.spec.ts` line 78: S7 axe New, Cooking, Kitchen; K4 ticket aur K1/K2 gate bahar. #222 wala hi sawaal: Night me gate (lockup-day) ka contrast kahan check hua?

### Future
- `app/src/screens/KitchenScreen.tsx` line 114: "Till 22:00 · customers see closed the moment you switch off": 22:01 par switch ON ho to customer ko closed dikhta hai (0022 rule) ya sirf text? Cook ko "auto-closed" batana chahiye?
- `docs/follow-ups.md` line 152: F146 chhe deviations, reviewer ka jawab: (1) bada type aur button, haan (D3); (2) note nahi, theek; (3) ready par rider naam nahi: F jab rider assign dikhe; (4) cash line theek; (5) sign out row theek; (6) console bina controls theek. Haan ya kuch alag?

</details>

## 17. Self-check (light, 2-3)
1. Agar kitchen ki row padhi hi nahi gayi, to switch kya dikhata hai? Kya woh sach hai?
2. Kitchen mein "New tickets ring" likha hai. Is diff mein sound kahan se aata hai?
3. Accept dabaya. Ticket New se gayab hua. Kya cook ko Cooking tab par le jaaya gaya? Kab haan, kab nahi?

## Inline comments

Har comment ek teaching question hai. Status: sab open.

<!-- gh-comment-id: 4367917074 -->
- **File:** `app/src/lib/kitchen.ts` · **Line:** 29 · **Category:** Understanding
- **Question:** newTickets sirf placed; accepted + preparing Cooking; ready alag; cancelled kahin nahi (WITH_RIDER, pehle jaisa). Cook ne Start kar diya aur customer ne cancel kiya to ticket chup-chaap gayab: cook ko batana nahi chahiye?
- **Reply (klickbae8yt-star):** Agreed. Today a cancel after Accept is the admin's (the customer cancels only at Placed), and the ticket just leaves. F148 (in #226): a "Cancelled" stamp on the ticket for a minute, or a one-line notice, before it goes.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367917077 -->
- **File:** `app/src/lib/rider.ts` · **Line:** 31 · **Category:** Alternatives
- **Question:** `import type { Done }` file ke beech me, code ke baad. Lint nahi rokta? Upar le jao, ek line.
- **Reply (klickbae8yt-star):** Fixed in 1d0d196 (PR #226): the `import type { Done }` sits at the top of lib/rider.ts.
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917078 -->
- **File:** `app/src/screens/KitchenGate.tsx` · **Line:** 24 · **Category:** TOP · Risk
- **Question:** kitchens row na padh paye to open = true default. Switch "Open" dikhayega jabki asli state pata nahi; cook sochega sab theek hai. Unknown ko unknown dikhao (switch disabled + "could not read the kitchen")?
- **Reply (klickbae8yt-star):** Fixed in 1d0d196 (PR #226): `open` is null when the row cannot be read; the switch is disabled with "Could not read the kitchen. Reload to try again." and the header says Unknown. kitchen-ink S8 covers it.
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917082 -->
- **File:** `app/src/screens/KitchenGate.tsx` · **Line:** 61 · **Category:** Understanding
- **Question:** flipOpen rpc ke baad local row badalta hai. Customer side "closed" realtime se dekhta hai ya agle menu read par? Copy "the moment you switch off" kehti hai: kaunsa test yeh proof deta hai?
- **Reply (klickbae8yt-star):** Next read, not realtime: kitchens has no live channel; the customer sees "closed" on the next pin check or menu load. The copy now says "customers see closed on their next look" (1d0d196 (PR #226)). The customer side is area.spec (closed board).
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917086 -->
- **File:** `app/src/screens/KitchenScreen.tsx` · **Line:** 99 · **Category:** TOP · Assumptions
- **Question:** "New tickets ring · accept within 2 min": ring hai kya? Is diff me audio nahi, push hai (enablePush). Copy ek vaada hai jo screen nahi nibhati. Ring kis story me, ya copy badlo?
- **Reply (klickbae8yt-star):** No ring in this diff; the kitchen's alert is push where the phone allows it. Copy changed to "New tickets land here · accept within 2 min" (1d0d196 (PR #226)). A ring is a story if the owner wants one.
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917089 -->
- **File:** `app/src/screens/KitchenScreen.tsx` · **Line:** 30 · **Category:** Risk
- **Question:** Accept list se → ticket New se gayab, tab New hi rehta hai (cook khud Cooking khole). K4 se Accept → Cooking tab. Ek tap, do behaviour. Board kya kehta hai? Dono me Cooking par jaana saaf hota?
- **Reply (klickbae8yt-star):** Kept on purpose: three new tickets take three Accept taps on New; a jump to Cooking after each would cost a tap back. From K4 the ticket is full screen and the next step lives on Cooking, so it lands there. The board links K3 rows to K4 and K4's Accept to K-Cooking.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367917092 -->
- **File:** `app/src/screens/KitchenScreen.tsx` · **Line:** 59 · **Category:** Testability
- **Question:** aria-label "Back to new tickets" Cooking se khole ticket par bhi; neeche ka button sahi bolta hai ("Back to cooking"). Label ko bhi tab se baandho.
- **Reply (klickbae8yt-star):** Fixed in 1d0d196 (PR #226): the arrow says "Back to cooking tickets" or "Back to new tickets" by the tab, the ghost button "Back to cooking" or "Back to new". kitchen-ink S9.
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917094 -->
- **File:** `app/src/screens/KitchenScreen.tsx` · **Line:** 24 · **Category:** Impact
- **Question:** onSlips = aaj ke sab delivered ka total; rider ka "Cash in hand" sirf apna cash. Do screens, do numbers. Raat ko hisaab milane ka flow (kitchen vs rider) kis story me? Ek line F me likho.
- **Reply (klickbae8yt-star):** F147 (in #226): the hand-over flow, kitchen confirms the rider's cash at close, as a pilot-ops story.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367917097 -->
- **File:** `app/src/screens/KitchenScreen.tsx` · **Line:** 114 · **Category:** Future
- **Question:** "Till 22:00 · customers see closed the moment you switch off": 22:01 par switch ON ho to customer ko closed dikhta hai (0022 rule) ya sirf text? Cook ko "auto-closed" batana chahiye?
- **Reply (klickbae8yt-star):** The customer side closes by hours in area.ts whatever the switch says. The sub line now says so after closing time: "Past 22:00 · customers see closed till opening time" (1d0d196 (PR #226)).
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917101 -->
- **File:** `app/src/screens/KitchenTools.tsx` · **Line:** 29 · **Category:** TOP · Risk
- **Question:** VegMark veg = d.veg !== false: listDishes ke select me `veg` nahi hai to sab dish hari dikhegi (non-veg bhi). Select me veg hai? Ek unit test non-veg ka?
- **Reply (klickbae8yt-star):** `listDishes` selects `veg` (admin.ts line 75), so a non-veg dish gets the red mark; the K-YourKitchen shot shows Chicken Curry red. VegMark itself has its unit test from H10b.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367917104 -->
- **File:** `app/src/screens/KitchenTools.tsx` · **Line:** 20 · **Category:** Purpose
- **Question:** Category groups ka order = jis order me dishes aaye. Customer menu ka category order yahi hai? Cook aur customer alag order dekhein to "Thali" dhoondhna mushkil.
- **Reply (klickbae8yt-star):** Same order on both: the dishes come sorted by `sort` then `name`, the kitchen groups them first-seen, and the customer's `categoriesOf` keeps first-seen order on the same list.
- **Status:** answered, resolved 24 Oct

<!-- gh-comment-id: 4367917105 -->
- **File:** `app/src/ui/ui.css` · **Line:** 318 · **Category:** Alternatives
- **Question:** 18 px lines aur 56 px Accept (F146.1, D3 wet hands): haan, D3 board se jeet-ta hai. Token banao (`--gs-text-kitchen`, `--gs-tap-kitchen`) taaki rider ka Picked up bhi wahi le?
- **Reply (klickbae8yt-star):** Fixed in 1d0d196 (PR #226): `--gs-text-staff: 18px` in tokens.css drives the ticket lines; taps already use `--gs-tap-big` (the rider's Picked up is the same big class).
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917110 -->
- **File:** `app/tests/e2e/kitchen-ink.spec.ts` · **Line:** 9 · **Category:** Testability
- **Question:** S1 badge "1 new" getByLabel. Zero par badge nahi (falsy). S3 quiet state me badge absent assert karo, warna "0 new" kabhi aa jaye to pata nahi chalega.
- **Reply (klickbae8yt-star):** Fixed in 1d0d196 (PR #226): S3 asserts no element labelled "... new" in the quiet state.
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917118 -->
- **File:** `app/tests/e2e/kitchen-ink.spec.ts` · **Line:** 78 · **Category:** Testability
- **Question:** S7 axe New, Cooking, Kitchen; K4 ticket aur K1/K2 gate bahar. #222 wala hi sawaal: Night me gate (lockup-day) ka contrast kahan check hua?
- **Reply (klickbae8yt-star):** Fixed in 1d0d196 (PR #226): S7 scans K3, K4, K3b, K5, K1 and K2 in Day and Night, all clean.
- **Status:** fixed 1d0d196 (#226), resolved 24 Oct

<!-- gh-comment-id: 4367917125 -->
- **File:** `docs/follow-ups.md` · **Line:** 152 · **Category:** Future
- **Question:** F146 chhe deviations, reviewer ka jawab: (1) bada type aur button, haan (D3); (2) note nahi, theek; (3) ready par rider naam nahi: F jab rider assign dikhe; (4) cash line theek; (5) sign out row theek; (6) console bina controls theek. Haan ya kuch alag?
- **Reply (klickbae8yt-star):** Yes to 1, 2, 4, 5, 6. (3) points at F149: the rider's name on the ready ticket once the order read carries it. Row updated in #226.
- **Status:** answered, resolved 24 Oct

## 18. Handoff

State: 0 answered · 0 need-fix · 15 open · actor: coder

```
To coder, from reviewer, re PR #223:
1. Approved. 15 teaching questions inline, 3 TOP (the gate shows Open when the row cannot be read; "New tickets ring" promises a sound the screen does not make; VegMark defaults to veg). Reply on each in 1-2 sentences; a fix is a commit on this layer.
2. F146: all six accepted; (1) the 18 px and 56 px stay for D3, put them in tokens; (3) open a follow-up for the rider name on a ready ticket.
3. Continue development: story #195 "H12 UI rollout: admin" on feat/195-admin-ui from dev after #222 and #223 merge; paste the first red run.
Need from you: the thread replies and the #195 PR number.
```

---

## What happened after review
- Review post hua: 5639174623 (APPROVE), 15 inline comments.
- Replies: 0 answered, 15 open.
- Merge: pending. #222 ke baad.
