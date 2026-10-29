# Play Console: the closed test (story #254)

Goal (owner, 29 Oct 2026): by 2 Nov the Bubblewrap app is on Google Play in a closed test. This page lists every step. The owner holds the Play account. Steps marked **Owner** need his login. Nothing here asks for a secret in chat.

## What we already have
- The app: package `in.goserve.customer`, built by `.github/workflows/build-apk.yml` from a published release. Release `v1.0.0` carries `goserve-1.0.0.apk` and `goserve-1.0.0.aab`.
- The upload key: the vault copy is `~/Desktop/Secrets/08_android_keystore.env`. The key itself never leaves the vault and GitHub secrets.
- The privacy page: https://goserve-app.pages.dev/privacy/ (story #302). It is a draft for the test phase; a lawyer-checked page comes before the pilot.
- The listing words and pictures: `design/play/` (this PR).

## A rule from Google you must plan for (Tier A, Google Play Console Help, read 29 Oct 2026)
A personal developer account made after 13 Nov 2023 must run a closed test with at least 12 testers, opted in for 14 days in a row, before it can apply for production. So the closed test is not only a test. It starts that clock. Confidence 0.9. If the account is an organization account, ask Google's page again: the page does not say it is exempt. **Production on 2 Nov is not possible for a personal account. A closed test on 2 Nov is.**

## Steps
Each step is one thing to do. Do them in order.

1. **Owner.** Open the Play Console and choose **Create app**. Name: `GoServe: home kitchen thali`. Default language: English (India). App or game: App. Free or paid: Free. Accept the two declarations.
2. **Owner.** Open **Dashboard**, and finish the tasks it lists, in this order (the next steps say what to type).
3. **Privacy policy.** Under **Policy and programs > App content > Privacy policy**, paste `https://goserve-app.pages.dev/privacy/`.
4. **App access.** Under **App content > App access**, choose "All or some functionality is restricted" and add one instruction set. Name: `Customer test`. Instructions: "Open the app. Type a pin code that GoServe serves (the owner gives the current one). When the app asks for the phone code, use the fixed test code 123456." Nothing else is needed: there is no password.
5. **Ads.** Choose "No, my app does not contain ads".
6. **Content rating.** Start the IARC questionnaire. Category: Utility, productivity, communication or other (a food ordering app). Answer No to violence, sex, drugs, gambling and user-to-user chat. The app sends the customer's own feedback to our team only. Expected rating: for everyone. Check the result before you accept it.
7. **Target audience.** Choose 18 and over. The app is not for children.
8. **Data safety.** Use the table below. Check it against the privacy page again if the app changes. If any row is unclear, choose the more open answer.
9. **Government apps, financial features, health.** Answer No.
10. **Store listing.** Under **Grow users > Store presence > Main store listing**: title from `design/play/title.txt`, short description from `design/play/short-description.txt`, full description from `design/play/full-description.txt`. App icon: `app/public/icons/customer-512.png`. Feature graphic: `design/play/feature-graphic.png` (1024 by 500). Phone screenshots: the four files `design/play/screenshot-*.png` (1080 by 1920), in the order of their numbers.
11. **Closed testing.** Under **Test and release > Testing > Closed testing**, create a track (the default one is fine). Under **Testers**, make an email list (the testers' emails come from the owner; Google wants 12 or more) and save. Copy the opt-in link and send it to the testers.
12. **Upload the bundle.** Under the same track, **Create new release**. Accept **Play App Signing** when it asks. Upload `goserve-1.0.0.aab` from the GitHub release `v1.0.0`. Release name `1.0.0`. Release notes: "First closed test of GoServe." Save, review, and **Start rollout to closed testing**.
13. **Wait for review.** The first review can take days. The track shows the state.

## Data safety answers (from the privacy page, 25 Oct 2026, confidence 0.7: the owner decides)
| Question | Answer | Why |
|---|---|---|
| Does the app collect or share user data? | Yes, it collects | Orders and profile |
| Is all data encrypted in transit? | Yes | HTTPS only |
| Can users ask to delete their data? | Yes: write to avinturetech@gmail.com | Privacy page, "Your choices". Because the app has a Google sign-in, Play may also ask for a web link that explains deletion: use the privacy page |
| Name | Collected, not shared. Purpose: app functions. Optional | Saved profile and the bill |
| Phone number | Collected, not shared. Purpose: app functions (the rider calls it) | The bill |
| Email address | Collected only if the customer taps Continue with Google, not shared. Purpose: account management | Google sign-in |
| Address | Collected, not shared. Purpose: app functions | The delivery address |
| Approximate or precise location | Collected only when the customer taps Use my location. It is sent once to OpenStreetMap's address lookup and not kept. Answer **shared** with OpenStreetMap (a third party), purpose app functions. Owner: confirm this reading | Privacy page, "Use my location" |
| Photos | Collected only if the customer adds a picture to a feedback report. Purpose: app functions | Feedback sheet |
| App activity, in-app actions | **Not collected in the Play build.** Analytics (PostHog) runs only in the dev build, which has a key; the prod build has none | `deploy-app.yml` carries no PostHog key |
| Device or other IDs | A push address the phone gives us, only if the customer allows notifications. Purpose: app functions | Privacy page |
| Financial info, health, contacts, messages, audio, files | Not collected | Cash on delivery |

## The second fingerprint (the Play App Signing step, owner)
After the first upload Google signs the app with its own key. The Digital Asset Links file must then list Google's key too, or the app shows a browser bar at the top (the Trusted Web Activity check fails).
1. **Owner.** In the Play Console open **Test and release > App integrity > App signing**. Under "App signing key certificate" copy the **SHA-256 certificate fingerprint**.
2. Send it to the coder (a fingerprint is public, not a secret).
3. The coder adds it as a second value of `sha256_cert_fingerprints` for `in.goserve.customer` in `app/public/.well-known/assetlinks.json` (the upload key's fingerprint stays), in a PR to `staging`, then it is released to `main`. Check: `https://goserve-app.pages.dev/.well-known/assetlinks.json` lists both.
4. Install the app from the Play link on a phone. It opens full screen, with no address bar.

## The publishing step stays by hand
`build-apk.yml` can send the bundle to Play with a service account (`PLAY_SERVICE_ACCOUNT_JSON`). It is optional. Without the secret the step is skipped. For the first release the upload is by hand (step 12).

## What not to do
- Do not type the keystore or its passwords anywhere in chat.
- Do not apply for production before the 14 days and 12 testers are met.
- Do not change the package name `in.goserve.customer` after the first upload.

## Check after the rollout
- [ ] A tester opens the opt-in link and installs GoServe from Play.
- [ ] It opens on the pin screen, full screen, no address bar (after the second fingerprint).
- [ ] The track shows version 1.0.0 as available to testers.
