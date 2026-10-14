# PR #68 — docs: order workflows deployed inactive, A41 and A42 confirmed

- Branch `docs/46-deployed-inactive` → `dev`
- Author: klickbae8yt-star
- Follow-up to #67 (story #46, epic #35)
- State: **APPROVED** — head `c40732d` (2026-10-14, review 5511808975 by `satvik-jain-iitd`), CI green, merge pending
- Files: 10 (4 notebook)
- Lines: +124/-41
- Docs only, no code
- Reviewer: satvik-jain-iitd
- Link: https://github.com/satvik-jain-iitd/GoServe/pull/68

> Deploy ho gaya, par shutter abhi band hai. Yeh PR yahi likhta hai, aur yeh bhi check karta hai ki docs live n8n se match karte hain.

## Overall review

### 1. Logline
Six order workflows ab n8n par hain, par inactive hain. Yeh docs PR unhe registry mein likhta hai. Owner ne A41 aur A42 confirm kiye.

### 2. Big Picture
- Order path ke six workflows (ERR 00, SUB 11 to 14, MAIN 01) ab n8n instance par hain. [VERIFIED]
- PR sirf docs hai: registry, credential line, assumptions, follow-ups, trace, discussion, LEARNINGS.
- Code nahi badla. Activation (live switch) abhi nahi hua.

### 4. Real-Life Analogy
Dhaba ke register mein counter boy, dispatcher aur duty register ki entry ho gayi, aur stamp bhi lag gaya. Par shutter band hai, to abhi koi order nahi le sakta. Canvas ka look (B12.6) abhi aisa hai jaise deewar par chart laga diya, par kisi ne khade hokar dekha nahi.

### 6. High-Level Flow
1. Owner ki haan (do chats mein).
2. OpenRouter credential bana.
3. `deploy.js --apply` chala: six workflows gaye, phir read back hue, sab inactive.
4. Docs update hue.
5. Yeh PR.

Next: canvas look, phir activation yes, phir SUBs activate, phir MAIN, phir live rows.

### 7. The Cast (files)
- `docs/integrations/n8n-order-workflows.md`: registry rows mein ids, credential line.
- `docs/assumptions.md`: A41, A42 Confirmed.
- `docs/follow-ups.md`: F67 updated.
- `docs/process-trace.md`: rows 148 to 150.
- `docs/discussions/2026-10-14.md` aur `docs/LEARNINGS.md`: ek-ek line.
- Notebook: pr-67 chapter sync, README, mental-model, my-questions.

### 9. What changed vs before
- Registry rows: "Deployed 14 Oct 2026, inactive (id ...)".
- Credential line: OpenRouter credential bana, id, $2 cap dashboard par, sirf openrouter.ai tak limited.
- A41 aur A42: Confirmed (owner, 14 Oct 2026).
- F67: bana aur deploy hua; live Jev rows abhi baaki.

### 10. Macro Risks
1. Editor mein kabhi nahi dekha (B12.6). Layouts tests mein pass hue, par canvas kisi ne nahi dekha. Kharab render activation ke waqt hi dikhega. [VERIFIED trace row 150]
2. Activation abhi pending. Live rows (5 calls, Jev, Jev-down) tab tak nahi chal sakte. [VERIFIED]
3. Rows 146 aur 149 dono owner ki haan likhte hain. Theek hai, par reader do faisle gin sakta hai. [VERIFIED]

### 11. Deliberately not here
- Activation aur live calls: alag yes chahiye.
- Code: yeh docs follow-up hai.

### 12. Testing Story
- Docs PR hai, isliye naya test nahi chahiye.
- Reviewer ne live check kiya [VERIFIED]: `n8n-cli workflow list` mein six GS workflows hain, sab `active: false`, ids registry se match karte hain.
- Dono credentials mile: `GoServe Supabase dev` aur `GoServe OpenRouter`.
- Dry run mein six ke aage "update" dikha. Kuch activate nahi hua.

### 15. AI-Review Lens
- Trust: ids aur states instance se match karte hain (verified).
- Interrogate: "deployed" mein kya chhoota? Canvas ki aankh nahi. Aur kya docs ke claims system se check hue, ya sirf script ke output se?

### 16. Questions
Teen sawaal. Top-3 wala sabse upar hai.

1. **Testability** (`docs/process-trace.md` line 158, Top-3): Row 150 mein likha hai ki n8n login vault mein nahi hai, isliye editor ka screenshot nahi hai. B12.6 kehta hai deploy ke baad editor mein fit-view dekho. Owner khud six canvases dekh le (links registry mein), ya n8n login vault mein jaaye taaki agent dekhe? Activation se pehle yeh check chahiye.
2. **Purpose** (`docs/integrations/n8n-order-workflows.md` line 10): Ids ab registry mein hain (live match: 6 workflows, sab inactive, ids same, dry run "update"). Rulebook 95.23 ka registry test (folder vs registry) ab possible hai. F66(f) kab, #47 ke saath?
3. **Impact** (`docs/process-trace.md` line 157): Rows 146 aur 149 dono owner ki haan hain. Do jagah bola to do rows theek hain. Kya ek line "same haan as 146" jod doge, taaki koi do faisle na gine?

Self-check prompts:
- Deployed aur active mein farak kya hai?
- Activation se pehle kya dekhna baaki hai?

## Files (ek-ek)

### `docs/process-trace.md`
Yeh file har step ka log hai, dhaba ki ek-ek entry jaisi. Is PR mein rows 148 se 150 aaye, aur do sawaal isi file ki lines par hain.

**Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265647403 -->
> **Top-3** — Row 150 mein likha hai ki n8n login vault mein nahi hai, isliye editor ka screenshot nahi hai. B12.6 kehta hai deploy ke baad editor mein fit-view dekho. Owner khud six canvases dekh le (links registry mein), ya n8n login vault mein jaaye taaki agent dekhe? Activation se pehle yeh check chahiye.
- **Status:** answered
- **Reply (klickbae8yt-star):** Owner editor mein 6 canvases fit-view kar sakta hai (links registry mein), ya n8n login vault mein. Owner ka choice; activation se pehle.
- **Lesson:** Deploy ke baad aankh se dekhna owner ya agent kare, par kare zaroor (B12.6).

<!-- gh-comment-id: 4265647410 -->
> Rows 146 aur 149 dono owner ki haan hain (reviewer chat, coder chat). Do jagah bola to do rows theek hain. Kya ek line "same haan as 146" jod doge, taaki koi do faisle na gine?
- **Status:** answered
- **Reply (klickbae8yt-star):** Sahi. Row 149 = wahi haan jo row 146 mein hai, do chats mein. #48 docs mein 'same haan as 146' jodunga.
- **Lesson:** Ek faisla do jagah likha ho to link karo, warna do gine jaate hain.

### `docs/integrations/n8n-order-workflows.md`
Yeh registry hai: contract aur ids ki list. Line 10 pehla row hai, jisme ab ids aur "Deployed 14 Oct 2026, inactive" likha hai.

**Inline comments (posted by satvik-jain-iitd):**

<!-- gh-comment-id: 4265647405 -->
> Ids ab registry mein hain (live match: 6 workflows, sab inactive, ids same, dry run "update"). Rulebook 95.23 ka registry test (folder vs registry) ab possible hai. F66(f) kab, #47 ke saath?
- **Status:** answered
- **Reply (klickbae8yt-star):** Haan, registry test ab possible hai; live activation step ke saath likhunga (F66 f).
- **Lesson:** Registry test tab, jab registry aur folder dono sach hon.

## Handoff

- **Sync (14 Oct):** 3/3 threads answered; canvas look = owner's choice before activation; registry test with activation (F66 f); row 149 gets 'same haan as 146' in the #48 docs. Merged by the owner.


State: 3 posted · 0 must-fix · actor: owner (merge, canvas look, activation yes)

You are the developer for GoServe. Do this: (1) reply on the 3 threads; (2) continue story #48 on feat/48-customer-screen; (3) when the owner says "activate": activate SUB 11, 12, 13, 14 and ERR 00 first, then MAIN 01; run the live rows (401, 201, 200, 409, 503; one Jev call; one Jev-down check) and record MAIN and SUB execution ids in test-cases; (4) copy the reviewer's bundle (pr-68 chapter) as the last step of the #48 PR.

_(PR par post hua — `satvik-jain-iitd`, APPROVE review 5511808975 with 3 inline threads, 14 Oct 2026.)_

**Owner handoff**

```text
Owner ke liye, next step:
1. PR #68 merge karo.
2. Six workflows n8n editor mein kholo, fit view dabao, aur dekho: har link left se right ja raha ho, aur koi line kisi title ke upar se na jaye (B12.6). Ya n8n login vault mein daal do, taaki agent dekh sake.
3. Canvas theek lage to "activate" bolo. SUBs pehle, phir MAIN.
4. F61 abhi pending hai.
```
