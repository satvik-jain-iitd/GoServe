# PR #226, #227, #228 — H11 review fixes, no Google on the customer app, Day by default

Teen chhoti layers, ek stack. Sab approve, sab CI green. Yeh chapter chhota hai: teen PR, ek hi kahani (dhaba ka counter theek karna: cook ka switch, delivery boy ki ghadi, customer ka darwaza).

| PR | Branch | Head | Review | Kya |
|---|---|---|---|---|
| [#226](https://github.com/satvik-jain-iitd/GoServe/pull/226) | `feat/194-h11-review` → `dev` | `1d0d196` | APPROVE 5639339438 | #222 aur #223 ke 32 threads ke 11 fix: location copy LOCATION_EVERY_MS se, rider ka job sabse purana pehle, ek Tabs component (TabBar wrapper), kitchen switch disabled jab row na padhe, sachchi copy (land here, next look, past closing), back label tab se, --gs-text-staff token, har state par axe. F145 (7) withdrawn, F147 to F149 naye. |
| [#227](https://github.com/satvik-jain-iitd/GoServe/pull/227) | `feat/224-customer-no-google` → `feat/194-h11-review` | `422e8ca` | APPROVE 5639342341 | App.tsx: SignIn sirf console par (framed app me kabhi nahi). login.spec aur profile S7 console / par. customer-chrome.spec: 3 tests, red first. Owner ka phone finding (#224). |
| [#228](https://github.com/satvik-jain-iitd/GoServe/pull/228) | `feat/225-day-default` → `feat/224-customer-no-google` | `b65f80b` | APPROVE 5639340066 | theme.ts: pin ya Day, clock gaya; index.html first paint wahi; You par Day/Night chips, By the clock chip gaya; ADR-019 point 3 amended. Red: 3 unit + account S3. Owner ka call (#225). |

## Sync (#222, #223)
- 32 of 32 threads answered; 11 fixed in 1d0d196; sab GitHub par resolved. Chapters pr-222 aur pr-223 me replies folded. [VERIFIED]

## Inline comments

Har comment ek teaching question hai. Status open jab tak coder reply na kare.

### PR #226

<!-- gh-comment-id: 4368008829 -->
- **File:** `app/src/screens/KitchenScreen.tsx` · **Line:** 51 · **Category:** 4 Risk
- **Question:** pastClose "HH:MM" string compare: closes_at "22:00" par sahi. Agar koi kitchen raat 02:00 band hoti hai (closes_at "02:00") to din bhar pastClose true: "Past 02:00 · customers see closed". area.ts ka hours check isi tarah karta hai ya midnight cross sambhalta hai?
- **Reply (klickbae8yt-star):** Fixed in 7d3f78a (PR #232): `outsideHours(opens, closes, now)` in lib/kitchen handles a kitchen that closes after midnight (open 18:00 to 02:00: 01:00 is inside, 03:00 and 17:00 outside); the gate now reads opens_at too. Unit test with six cases. area.ts does
- **Status:** fixed 7d3f78a (#232), resolved 25 Oct

<!-- gh-comment-id: 4368008834 -->
- **File:** `app/src/screens/KitchenGate.tsx` · **Line:** 63 · **Category:** 2 Understanding
- **Question:** open null par flipOpen chup-chaap lautta hai aur copy "Reload to try again" kehti hai. Reload ke bajaye ek "Try again" tap jo row dobara padhe, sasta hota? Pilot me cook reload samjhega?
- **Reply (klickbae8yt-star):** Fixed in 7d3f78a (PR #232): when the row cannot be read the switch is replaced by a "Try again" button that reads the row again (gate `retry`), no reload. kitchen-ink S8 covers the retry.
- **Status:** fixed 7d3f78a (#232), resolved 25 Oct

<!-- gh-comment-id: 4368008837 -->
- **File:** `app/src/lib/rider.ts` · **Line:** 11 · **Category:** 8 Future
- **Question:** locationLabel LOCATION_EVERY_MS se: sahi pattern. Kitchen par "accept within 2 min" bhi hard text hai; woh 2 min kis constant se aata hai (confirm_cfg, Jev, ya bas copy)? Wahi pattern wahan bhi?
- **Reply (klickbae8yt-star):** "Accept within 2 min" is copy from the board, not a constant: nothing in the app enforces it (the kitchen alert threshold lives in the n8n health check). Left as copy; if a constant appears (H17 PostHog or the health params), the line reads from it like locati
- **Status:** answered, resolved 25 Oct

<!-- gh-comment-id: 4368008840 -->
- **File:** `app/src/ui/index.tsx` · **Line:** 121 · **Category:** 7 Testability
- **Question:** Tabs par aria-label={t.name}: name undefined ho to React attribute hi nahi deta, to rider/kitchen tabs ka accessible name visible word rehta hai. Ek test jo "My orders" aur "Job" dono ko dhoondhe, taaki wrapper kabhi toote to pata chale?
- **Reply (klickbae8yt-star):** Fixed in 7d3f78a (PR #232): customer-chrome S3 asserts the tab names on all three apps: Menu, My orders, You (Account); Job, Today, Me; New, Cooking, Kitchen. If the wrapper drops a name, it fails.
- **Status:** fixed 7d3f78a (#232), resolved 25 Oct

<!-- gh-comment-id: 4368008842 -->
- **File:** `docs/follow-ups.md` · **Line:** 153 · **Category:** 6 Impact
- **Question:** F147 "pilot-ops story" kehta hai par GitHub par story nahi hai. Rule 4: kaam sirf issues se. F147, F148, F149 ko stories (epic #182 ya pilot epic) me kab badloge, pilot se pehle kaun si zaroori hai?
- **Reply (klickbae8yt-star):** Done: stories #229 (F147 cash day and hand-over), #230 (F148 cancelled ticket), #231 (F149 rider name), all under epic E20 #203; the follow-up rows point at them. Before the pilot: #229 (the cash count at close); #230 and #231 can wait for the first week.
- **Status:** answered, resolved 25 Oct


### PR #227

<!-- gh-comment-id: 4368010074 -->
- **File:** `app/tests/e2e/customer-chrome.spec.ts` · **Line:** 1 · **Category:** TOP · 5 Alternatives
- **Question:** Google gaya, par owner ke screenshot me neeche "GoServe" title, floating Feedback button, tagline bhi hain. Feedback ab You screen par hai (H10d), to neeche wala duplicate hai. Isi layer me customer lock par woh teen bhi hatao (Privacy, Terms rakho)? Owner ka jawab chahiye.
- **Reply (klickbae8yt-star):** Waiting for the owner's word on the title, Feedback button and tagline (the block to the owner asks). Privacy and Terms stay either way. Nothing touched yet.
- **Status:** answered, resolved 25 Oct

<!-- gh-comment-id: 4368010078 -->
- **File:** `app/tests/e2e/customer-chrome.spec.ts` · **Line:** 10 · **Category:** 7 Testability
- **Question:** Privacy aur Terms "toBeAttached", visible nahi. Frame ke neeche scroll par dikhte hain, to toBeVisible kyun nahi? Attached to hidden bhi pass ho jata hai.
- **Reply (klickbae8yt-star):** Fixed in 7d3f78a (PR #232): the test scrolls the Terms link into view and asserts both links visible.
- **Status:** fixed 7d3f78a (#232), resolved 25 Oct

<!-- gh-comment-id: 4368010082 -->
- **File:** `app/tests/e2e/login.spec.ts` · **Line:** 24 · **Category:** 6 Impact
- **Question:** Google link flow ab sirf console "/" par chalta hai. H2 ne prod par demo console band kiya tha, to prod par customer ke liye Google ka koi raasta nahi bacha: yahi chahiye (MVP no login), ya "Use on another phone" hi customer ka account hai? Ek line assumptions.md me?
- **Reply (klickbae8yt-star):** Yes, by design: the customer has no login in the MVP; "Use on another phone" (the session link on You) is the customer's account. The demo console at / keeps the link flow for testing. Line added to docs/assumptions.md in the next docs commit (A-row with the o
- **Status:** answered, resolved 25 Oct


### PR #228

<!-- gh-comment-id: 4368009101 -->
- **File:** `app/src/lib/theme.ts` · **Line:** 12 · **Category:** 5 Alternatives
- **Question:** resolveTheme(pin, _hour?) me hour ab mara hua parameter hai, "callers need not change" ke liye rakha. Callers kitne hain? Ponytail: param hatao aur callers theek karo, warna yeh kal kisi ko clock wapas lagane ka bahana dega.
- **Reply (klickbae8yt-star):** Fixed in 7d3f78a (PR #232): `resolveTheme(pin)`, `pinTheme(store, doc, theme)`, `applyTheme(store, doc, pin?)`; the only app caller is main.tsx, already without an hour. No clock anywhere in lib/theme.
- **Status:** fixed 7d3f78a (#232), resolved 25 Oct

<!-- gh-comment-id: 4368009104 -->
- **File:** `app/index.html` · **Line:** 17 · **Category:** 7 Testability
- **Question:** Wahi rule do jagah: index.html ka inline script aur theme.ts. Koi test hai jo dono ko ek saath check kare (jaise tokens.json vs tokens.css wala unit test)? Nahi to agla badlav ek jagah hoga aur first paint galat.
- **Reply (klickbae8yt-star):** Fixed in 7d3f78a (PR #232): a unit test reads index.html and asserts the same key (`gs-theme`), the same default (`? p : "day"`) and no `getHours`, so the next change must touch both or fail.
- **Status:** fixed 7d3f78a (#232), resolved 25 Oct

<!-- gh-comment-id: 4368009106 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 22 · **Category:** 2 Understanding
- **Question:** Day chip pin hatata hai (DEFAULT ke barabar). Kal owner DEFAULT_THEME = "night" kare to Day chip pin banega aur Night chip pin hatayega: logic generic hai, sahi? Aur gs-theme me koi purana "day" pin pada ho to woh ab bhi pin ginega (harmless), theek?
- **Reply (klickbae8yt-star):** Yes, generic: `pick(t)` pins when t differs from DEFAULT_THEME and removes the pin when it equals it, so a Night default flips the roles by itself. An old stored "day" pin stays a pin and still means Day; harmless, and Day on You clears it.
- **Status:** answered, resolved 25 Oct


### PR #232 (Day default rebuilt from dev + the 11 fixes; APPROVE 5639433838)

#228 dev tak nahi pahuncha: uska merge feat/224 par 13 second baad laga jab woh branch pehle hi merge ho chuki thi. #232 = #225 ka commit + #226 to #228 ke 11 fix (7d3f78a). Sabak LEARNINGS me. Stories #229 to #231 F147 to F149 ke liye.

<!-- gh-comment-id: 4368076198 -->
- **File:** `app/src/lib/kitchen.ts` · **Line:** 39 · **Category:** 2 Understanding
- **Question:** outsideHours: opens === closes par "never outside" (0022 waise bhi equal rokta hai). Theek. Par "now" string "HH:MM" phone ke local time se aata hai; prod kitchen ka opens_at IST me hai. Admin ka phone IST ke bahar ho to? (Pilot me nahi; ek line assumptions.md me kaafi.)
- **Status:** open

<!-- gh-comment-id: 4368076201 -->
- **File:** `app/src/screens/KitchenScreen.tsx` · **Line:** 51 · **Category:** 4 Risk
- **Question:** pastClose har render par new Date() se banta hai, par koi timer nahi: 21:59 par khula tab 22:30 tak bhi "Till 22:00" dikhata rahega jab tak kuch re-render na ho (naya order, tap). Cook ke liye theek, ya ek minute ka tick chahiye?
- **Status:** open

<!-- gh-comment-id: 4368076203 -->
- **File:** `app/src/screens/KitchenGate.tsx` · **Line:** 29 · **Category:** 7 Testability
- **Question:** retry poora effect dobara chalata hai (session, getUser, myKitchen, row). S8 me row wapas aati hai. Ek aur case: retry ke baad bhi row na aaye, to "Try again" rehta hai, koi loop nahi? (tries sirf tap par badhta hai, samajh sahi?)
- **Status:** open

<!-- gh-comment-id: 4368076205 -->
- **File:** `docs/LEARNINGS.md` · **Line:** 207 · **Category:** 6 Impact
- **Question:** Stack ka sabak sahi hai, par yeh owner ki process ka hai, agent ki nahi: rule 19 me ek line chahiye: "merge the bottom layer, wait till GitHub retargets the next, then merge it; a layer merged into an already-merged base is lost". PLAN.md rule 19 isi PR me ya agle docs commit me?
- **Status:** open

## Handoff

#226, #227 merged (d0680eb, e5d0ea5); #228 merged into an already-merged base and never reached dev; #232 replaces it. Owner: merge #232, then #233. Coder: threads ka jawab; Feedback button par owner ka faisla; phir #195 H12 admin.
