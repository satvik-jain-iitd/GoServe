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
- **Status:** open

<!-- gh-comment-id: 4368008834 -->
- **File:** `app/src/screens/KitchenGate.tsx` · **Line:** 63 · **Category:** 2 Understanding
- **Question:** open null par flipOpen chup-chaap lautta hai aur copy "Reload to try again" kehti hai. Reload ke bajaye ek "Try again" tap jo row dobara padhe, sasta hota? Pilot me cook reload samjhega?
- **Status:** open

<!-- gh-comment-id: 4368008837 -->
- **File:** `app/src/lib/rider.ts` · **Line:** 11 · **Category:** 8 Future
- **Question:** locationLabel LOCATION_EVERY_MS se: sahi pattern. Kitchen par "accept within 2 min" bhi hard text hai; woh 2 min kis constant se aata hai (confirm_cfg, Jev, ya bas copy)? Wahi pattern wahan bhi?
- **Status:** open

<!-- gh-comment-id: 4368008840 -->
- **File:** `app/src/ui/index.tsx` · **Line:** 121 · **Category:** 7 Testability
- **Question:** Tabs par aria-label={t.name}: name undefined ho to React attribute hi nahi deta, to rider/kitchen tabs ka accessible name visible word rehta hai. Ek test jo "My orders" aur "Job" dono ko dhoondhe, taaki wrapper kabhi toote to pata chale?
- **Status:** open

<!-- gh-comment-id: 4368008842 -->
- **File:** `docs/follow-ups.md` · **Line:** 153 · **Category:** 6 Impact
- **Question:** F147 "pilot-ops story" kehta hai par GitHub par story nahi hai. Rule 4: kaam sirf issues se. F147, F148, F149 ko stories (epic #182 ya pilot epic) me kab badloge, pilot se pehle kaun si zaroori hai?
- **Status:** open


### PR #227

<!-- gh-comment-id: 4368010074 -->
- **File:** `app/tests/e2e/customer-chrome.spec.ts` · **Line:** 1 · **Category:** TOP · 5 Alternatives
- **Question:** Google gaya, par owner ke screenshot me neeche "GoServe" title, floating Feedback button, tagline bhi hain. Feedback ab You screen par hai (H10d), to neeche wala duplicate hai. Isi layer me customer lock par woh teen bhi hatao (Privacy, Terms rakho)? Owner ka jawab chahiye.
- **Status:** open

<!-- gh-comment-id: 4368010078 -->
- **File:** `app/tests/e2e/customer-chrome.spec.ts` · **Line:** 10 · **Category:** 7 Testability
- **Question:** Privacy aur Terms "toBeAttached", visible nahi. Frame ke neeche scroll par dikhte hain, to toBeVisible kyun nahi? Attached to hidden bhi pass ho jata hai.
- **Status:** open

<!-- gh-comment-id: 4368010082 -->
- **File:** `app/tests/e2e/login.spec.ts` · **Line:** 24 · **Category:** 6 Impact
- **Question:** Google link flow ab sirf console "/" par chalta hai. H2 ne prod par demo console band kiya tha, to prod par customer ke liye Google ka koi raasta nahi bacha: yahi chahiye (MVP no login), ya "Use on another phone" hi customer ka account hai? Ek line assumptions.md me?
- **Status:** open


### PR #228

<!-- gh-comment-id: 4368009101 -->
- **File:** `app/src/lib/theme.ts` · **Line:** 12 · **Category:** 5 Alternatives
- **Question:** resolveTheme(pin, _hour?) me hour ab mara hua parameter hai, "callers need not change" ke liye rakha. Callers kitne hain? Ponytail: param hatao aur callers theek karo, warna yeh kal kisi ko clock wapas lagane ka bahana dega.
- **Status:** open

<!-- gh-comment-id: 4368009104 -->
- **File:** `app/index.html` · **Line:** 17 · **Category:** 7 Testability
- **Question:** Wahi rule do jagah: index.html ka inline script aur theme.ts. Koi test hai jo dono ko ek saath check kare (jaise tokens.json vs tokens.css wala unit test)? Nahi to agla badlav ek jagah hoga aur first paint galat.
- **Status:** open

<!-- gh-comment-id: 4368009106 -->
- **File:** `app/src/screens/AccountScreen.tsx` · **Line:** 22 · **Category:** 2 Understanding
- **Question:** Day chip pin hatata hai (DEFAULT ke barabar). Kal owner DEFAULT_THEME = "night" kare to Day chip pin banega aur Night chip pin hatayega: logic generic hai, sahi? Aur gs-theme me koi purana "day" pin pada ho to woh ab bhi pin ginega (harmless), theek?
- **Status:** open

## Handoff

Owner: merge #226, phir #227, phir #228 (GitHub layers rebase karta hai). Coder: threads ka jawab; Feedback button par owner ka faisla; phir #195 H12 admin.
