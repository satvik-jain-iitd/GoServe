# Chapter: raat 25 Oct 2026 ke saat PR (#240, #243, #244, #245, #248, #256, #257)

## Logline

Ek raat mein saat PR merge hue: ek apne aap update hone wala roadmap page, ek UX safai, do releases, rider ka naam aur minutes, README ka naya sach, aur mobile stack ka faisla (ADR-020).
Har PR ne ek sawaal ka jawaab diya: owner ko kya dikhe, app mein kya chale, aur Android APK kis rasté se bane.

## Big picture

- Raat ka kaam GoServe ke MVP 3 ke aas-paas tha. Owner ne 03:45 par goal diya: Android APK 2 Nov tak, Laya ke saath zero running cost.
- Roadmap page (#240) owner ko project ka haal kisi bhi samay dikhata hai, bina kisi ko poochhe.
- UX pass (#243) purana shell aur legal footer har board se hata deta hai.
- Release (#244) dev ka kaam main par le gaya, aur reviewer ne live bundle khud dekha.
- Rider name aur minutes (#245) ready ticket par rider ka naam aur door ke minute dikhate hain.
- README v3 (#248) aur release (#256) docs ko naye goal se milate hain.
- Mobile stack ADR-020 (#257) ne pehle chaar TWA APKs aur baad mein rider app ka native Kotlin rasta chuna.
- Ghadi (brief ke time stamps): 01:54 launchd run exit 0, 02:36 Pages deploy, 03:45 MVP 3 goal, 04:45 ADR-020 ka pick.

## Ek PR, ek kahani

Har PR ko ek hi tarah padho:

- Pehle "Kya bana" dekho, yani PR ne kaun si cheez badli.
- Phir analogy, jo cheez ko ghar ki zindagi se jodti hai.
- Phir "Review mein kya nikla": pehle sawaal, phir must-fix, phir fix commit, phir APPROVE ka id aur merge sha.
- Aakhir mein "Ek seekh", jo agli baar kaam aayega.

### PR #240: live roadmap page (story #239, epic E21)

**Kya bana:**
- `scripts/roadmap.py` Python stdlib aur gh GraphQL se sab issues aur open PRs padhta hai.
- Yeh `docs/roadmap/index.html` likhta hai, jisme Vision, Delivered, Now, Next aur Board hain.
- Delivered mein har closed epic ek accordion hai, aur har story ki pehli "## Business" line dikhti hai.
- Now mein wo stories hain jinka open PR hai. Next mein wo open stories hain jinka PR abhi nahi hai, epic ke hisaab se.
- Board ke column hain: To do, Doing, Review, Done.
- PLAIN word list jargon badalti hai, par Board ke raw words rehte hain, aur "PR #n" bhi.
- Page har 300 second par refresh hota hai. launchd job har 15 minute par chalta hai.

**Analogy:** Ek shop ka notice board jo order book se har 15 minute mein apne aap likhta hai. Board khud nahi sochta, ek timer likhta hai.

**Review mein kya nikla:**
- Review COMMENT 5639758640 mein 4 sawaal the (ids 4368355458, 4368355464, 4368355466, 4368355467): Board ka jargon, pending checks wala column rule, launchd log line, aur epic regex par re.I.
- Now column ka rule: "review" tab jab checks green hon, "doing" jab checks red hon ya PR draft ho. Sawaal yeh tha ki pending checks kis column mein jaayen.
- Must-fix: generated `index.html` Git mein tracked tha. Job use har 15 minute par likhti thi, to har branch par dirty tree banta tha aur git checkout mana karta tha.
- Fix 2c0bebf: file untracked hui, `.gitignore` mein gayi, aur `docs/roadmap/README.md` aaya. Board ke raw words aur re.I bhi isi fix mein aaye.
- CI ek baar red hua: axe timing flake (kitchen-ink S7). `.ui-stamp` animation opacity 0.6 se shuru hoti hai, to 2.87:1 contrast animation ke beech padha gaya. Reviewer ne job dobara chalayi, green aaya.
- APPROVE 5639794039. Merge sha 9615dfa.
- Owner ne launchd job lagayi. Pehla run fail hua: CLT `/usr/bin/python3` ko `~/Documents` padhne se TCC ne rok diya ("Operation not permitted"). Fix: `/usr/local/bin/python3` aur absolute path. Run exit 0, output "updated 01:54 · 25 of 81 stories done".

**Ek seekh:** Jo file timer rewrite karta hai, use Git mein track nahi karte. Aur docs-only diff par red CI ho to pehle timing dhundho, diff nahi.

### PR #243: UX copy and chrome pass (story #242, epic E20)

**Kya bana:**
- Owner ne phone par scroll karke purana shell dekha: title, Feedback button, tagline, Privacy · Terms. Phir har visible string ki inventory bani (customer aur staff apps).
- 15 decisions (D1 se D15) owner ke saath ek-ek karke pakke hue. D1 ne shell aur legal footer har jagah hataya, console bhi.
- D3: "Send feedback" rows rider Me, kitchen Today tab aur admin Numbers mein aaye (gs-feedback event).
- D4: "Track an order" pin screen se hata. D8: users ke liye "slip" shabd nahi.
- D11 aur D12: rider ka tab "Delivery" hua, kitchen ka teesra tab "Today" hua.
- D15 bug: pin screen har open par dikhti thi, kyunki area null se shuru hota tha. Fix: `loadArea()` saved kitchen ko synchronously padhta hai (`lib/area.ts`), to menu network se pehle dikhta hai.
- Shabd bhi pakke hue: "Back in stock", "Cash at door", "Back to menu", "Ping me when it is ready".

**Analogy:** Restaurant ka menu card jisme printer ke notes fold ke neeche chhoot gaye the. Note sirf neeche tha, par card par tha.

**Review mein kya nikla:**
- Review COMMENT 5639876591 mein 3 sawaal the: AdminMenu aria label, `scan()` helper ka infinite animations par atakna, aur cached kitchen ka hamesha "ok" dikhna.
- Fix 396daef: scan iterations `Infinity` ko filter karta hai, aur `Promise.race` 1 second ki limit deta hai. "Put X back in stock" bhi isi fix mein.
- APPROVE 5639916508.
- Galti ka asar: merge ke baad bhi tree wahi tha jo reviewed tha, isliye reviewer ne re-approve kiya.
- Galti: owner ne #241 (cancelled ticket, story #230) ko #243 ki branch mein merge kar diya. Squash ce65e89 hua, jiska tree wahi tha jo reviewed bf90a85 ka tha. PR 50 files par tha, yani cap ke barabar. Re-approve 5639987835. Dev par 43c0f77 mein dono stories aayi.

**Ek seekh:** "Below the fold" ka chrome bhi page par hota hai. Ab ek Playwright check page ke end tak scroll karta hai aur wahan kuch nahi expect karta.

### PR #244: release to main (app/, design/, ops/launchd/, scripts/)

**Kya bana:**
- Dev (43c0f77) se `app/`, `design/`, `ops/launchd/` aur `scripts/` main par gaye.
- Kul 47 files. Reviewer ne empty diff verify kiya.
- Pages deploy 02:36 IST par hua. Yani dev ka kaam ab main par, aur live site par bhi.

**Analogy:** Courier hub ka dispatch truck. Sirf tayyar parcel jaate hain, aur dispatch bay par koi naya kaam nahi hota.

**Review mein kya nikla:** Brief mein is PR ke liye sawaal ya must-fix nahi likhe. APPROVE 5640002789. Merge sha 53bc4b9. Reviewer ne live bundle khud check kiya: tagline gayi, "Track an order" gaya, naya copy aaya.

**Ek seekh:** Release ke baad live site par dekhna bhi ek step hai, sirf merge hona kaafi nahi.

### PR #245: ready ticket names the rider and minutes away (story #231)

**Kya bana:**
- `minutesAway(rider, kitchen)` haversine formula se door nikalta hai, 18 km/h ki speed maanke.
- Minutes sirf tab dikhte hain jab rider ki location 10 minute se purani na ho. Yeh kabhi 0 nahi dikhta (A64).
- `rider_ping` (migration 0024) `riders.updated_at` stamp karta hai, to taazgi ka check asli hai.
- Cooking aur Today tabs par riders ki list padhi jaati hai.

**Analogy:** Kitchen ki deewar ghadi jo kehti hai "Amit, 4 min", aur yeh number Amit ke aakhri ping se hai. Yeh GPS ka vaada nahi hai.

**Review mein kya nikla:**
- Review COMMENT 5640037518 ka should-fix: riders har minute dobara padhe jaayen (minute tick effect ki deps mein), taaki "4 min" badle.
- A64 hint line bhi aayi: crow-flies distance Delhi ki sadkon ko lagbhag ek tihai kam dikhata hai. Brief mein is number ka source nahi likha.
- Fix c462109. APPROVE 5640050920. Merge sha 2e56059.
- Approve sirf fix ke baad mila. Pehle comment ka should-fix pura hona zaroori tha.

**Ek seekh:** Ek minute ka number tabhi bharosemand hai jab uski taazgi ka field asli ho.

### PR #248: README v3 (story #246)

**Kya bana:**
- README mein chaar apps hain, har ek ka live address ke saath.
- Har vyakti ke liye "What already works" section hai.
- Counts `scripts/test_readme.py` se honest rakhe gaye, yani test script hi check karta hai ki counts sach hain.
- Plan ka link `docs/mvp3/plan.md` par hai, aur yeh file commit ho chuki thi.

**Analogy:** Post office ka counter board. Har counter par kaun sa kaam chalta hai, yeh board par likha hota hai, aur board ka sach roz check hota hai.

**Review mein kya nikla:**
- Review COMMENT 5640137844 mein 3 comments the, sab line 7 par.
- Must-fix: README mein likha tha "No app store needed" aur "Native apps when the numbers say so". Yeh purana goal tha, naya goal owner ne 03:45 par diya tha.
- Q1: manifest mein "under 15 minutes" tha, README mein "25 to 35 minutes". Dono ko milaya gaya.
- Fix 6d11c47: goal lines badli gayi, aur manifest ab "Hot meals at your door in 25 to 35 minutes" kehta hai.
- Fix d798637: plan link jod diya.
- Approve sirf teeno comments ke fix ke baad diya gaya. APPROVE 5640159427. Merge sha 4c7b795.

**Ek seekh:** Docs mein purana vaada sabse chupa khatra hai. Goal badle to README bhi usi waqt badlo.

### PR #256: release to main (README.md, app/ rider name + manifest, scripts/test_readme.py)

**Kya bana:** Yeh release 9 files ka tha: README, rider ka naam aur manifest, aur test script. Reviewer ne empty diff verify kiya.
- Rider app ka naam aur manifest, dono is ek release mein main par gaye.

**Analogy:** Post office ki mohar. Letter tab tak nahi jaata jab tak mohar na lage, aur yahan main par mohar README aur manifest par lagi.

**Review mein kya nikla:** Brief mein is PR ke sawaal ya must-fix nahi likhe. APPROVE 5640199250. Merge sha ce6b5e1.

**Ek seekh:** Chhota release bhi poora check maangta hai. 9 files ka diff bhi khali verify karna hota hai.

### PR #257: mobile stack research + ADR-020 (story #250, epic E22)

**Kya bana:**
- `docs/research/mobile-stack-2026-10.md` mein Tier A claims hain: Meta, Microsoft, Amazon, Discord aur Bluesky React Native par hain. Flutter Google Pay aur NotebookLM par hai. Shopify 10 Sep 2026 par native Kotlin/Swift par wapas gaya.
- Ek comparison table hai: TWA, Expo, Flutter, KMP, Capacitor.
- ADR-020 Accepted hai (owner ka pick, 04:45). Stage 1: chaar TWA APKs, Bubblewrap se, 2 Nov tak. Stage 2: rider app native Kotlin mein, 3 Nov ke hafte mein do din ka spike ke baad.
- Expo, Flutter, KMP aur Capacitor ko ek-ek line mein reject kiya gaya.
- `app/public/.well-known/assetlinks.json` ek asli JSON file hai, aur ek red e2e test (S4) hai. Pages unknown paths par app shell ko HTML ki tarah serve karta tha, yeh test wahi pakad ne ke liye hai.
- Experiments E-TWA-1 se E-TWA-3 likhe gaye: screen-off location, foreground service, aur Expo port ka time-box.

**Analogy:** Courier hub ka sorting plan. Pehle sab parcel ek hi bag mein jaate hain (TWA), aur baad mein ek rute ke liye alag van (native).

**Review mein kya nikla:** Brief mein is PR ke sawaal ya must-fix nahi likhe. Owner ko plain words mein samjhaya gaya, jisme yeh bhi tha ki "iPhone needs an Apple account and review in every stack". Owner ka pick 04:45 par aaya, samjhaane ke baad. APPROVE 5640548549. Merge sha 4c05a09.

**Ek seekh:** Research mein har claim ke saath uska tier likho. Tier A ka matlab hai company ne khud kaha, sach hona alag baat hai.

## Raat ke paath

- Jo file timer rewrite karta hai, use Git mein track nahi karte. (#240)
- Red CI par docs-only diff ho to pehle timing dhundho, diff nahi. (#240)
- "Below the fold" chrome bhi page par hota hai. Ab Playwright check end tak scroll karta hai. (#243)

## AI-review lens

- **Bharosa karo:** jo cheez ek real run ya live check se aayi. Jaise "exit 0" wala run, aur live bundle par tagline ka gayab hona.
- **Sawaal karo:** README ka "No app store needed" line. Yeh confident tha, par naye goal se ulta tha. Aur A64 ka "about a third" number, jiska source brief mein nahi hai.
- **Confident but risky:** `index.html` ko Git mein rakhna ek confident default tha. Har 15 minute ki rewrite se har branch ka checkout toot sakta tha. Aur CI ke red hone par diff par shak karna galat rasta hota, kyunki asli wajah timing thi.

## Sawaal jo tum engineer se poochh sakte ho

1. "Kaun si generated files ek timer rewrite karta hai, aur kya unme se koi Git mein tracked hai?"
2. "Jab CI red ho aur change mein koi app code na ho, tum sabse pehle kya check karte ho?"
3. "Jab phone ki screen off ho, APK kya karta hai, aur kaun sa test ise prove karta hai?"
4. "Owner ne goal badla to README mein exactly kya badla, aur kya manifest bhi badla?"
5. "minutesAway 18 km/h kyun maanta hai, aur yeh number kis data se aaya? (brief mein nahi)"
6. "ADR-020 Stage 2 mein rider app native Kotlin kyun hai, aur spike kitne din ka hai?"
7. "#241 galti se #243 ki branch mein gaya, to tree kaise same raha, aur 50 files ka cap kaise maana gaya?"
8. "Launchd job kyun fail hua, aur fix ek permission issue tha ya Python version ka?"

## Handoff

- Owner ka agla kaam: pehle synthetic city (E16 H5 se H7), APK ke kaam se pehle.
- Uske baad: APK ka kaam, ADR-020 Stage 1 ke hisaab se, 2 Nov tak.
- Brief mein is ke aage ke steps nahi likhe, isliye yeh do hi step hain.

<!-- written by the haiku writer from brief-night-25oct.md, 25 Oct 2026 -->
