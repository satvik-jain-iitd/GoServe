# Options — frontend and backend languages

**Date read:** 13 Oct 2026. Decision (owner, 13 Oct): **frontend React + Vite + Capacitor; no custom backend server in MVP 0–2.**

## Teach me

Think of the app as a dhaba. The **frontend** is the counter and the menu board the customer sees. The **backend** is the
kitchen behind the wall. The browser can only read one language for the counter: JavaScript (TypeScript is JavaScript
with labels on every box, so mistakes show up early). The kitchen can use any language.

Right now our "kitchen" is ready-made: n8n holds the logic and Supabase holds the data and runs small SQL functions.
So we do not write a backend server yet.

## Frontend: one code for PWA, Android and iOS

| Option | What it is | Same code for app stores? | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|---|
| **React + Vite + Capacitor** (chosen) | Our web app runs as a PWA, and Capacitor wraps the same code as native iOS and Android apps with native plugins | Yes — "If it works in the browser, it probably works in a mobile app when using Capacitor" | UI is web, not native widgets (fine for our screens) | A | 0.8 | https://capacitorjs.com/docs |
| Background GPS for riders (Capacitor plugin) | Location updates while the app is in the background, on iOS and Android | Yes (MIT licence) | Android shows a persistent notification; may stop after 5 minutes in the background unless a setting is used; Android 13+ needs notification permission | A | 0.8 | https://github.com/capacitor-community/background-geolocation |
| React Native + Expo | One code for native iOS, Android and web; real native widgets | Yes | Web (PWA) output is heavier and different; a new way of building UIs | C (general knowledge) | 0.7 | — |
| Flutter | Google's toolkit in the Dart language | Yes | Not TypeScript; weaker web/PWA | C | 0.7 | — |
| Preact (first proposal) | A 3 KB React look-alike | Works with Capacitor | Some React libraries need a compatibility layer; React is safer for the long run | C | 0.7 | — |

Why React: it is the most used web framework — 46.9% of professional developers (Stack Overflow 2025; Next.js 21.5%, Svelte 6.9%). More libraries, more people to hire. (A, 0.85, https://survey.stackoverflow.co/2025/technology)

## Backend: is Rust the fastest? Should we use it?

| Language | Good at | Catch for GoServe | Use share (pro devs, SO 2025) | Tier | Conf |
|---|---|---|---|---|---|
| **Rust** | Fastest and memory-safe; top of public web benchmarks | Slow to write and compile; few Rust developers in India; our load (~13 orders a minute at 1 lakh users) is not CPU-bound — time goes to the network and the database | 14.5% | A (SO 2025), C (benchmarks from memory) | 0.8 |
| **TypeScript** (Node / Bun / Deno, Supabase Edge Functions) | Same language as the frontend; huge ecosystem; fast enough for us | Slower than Rust per CPU core (does not matter at our load) | 48.8% | A | 0.85 |
| **Go** | Simple, fast services; popular for infrastructure | A third language for a tiny team | 17.4% | A | 0.85 |

**Decision:** no custom server in MVP 0–2. If a custom service is needed later (for example, rider-location intake at MVP 3), write an ADR with a measured need, then pick Rust (Axum) for a hot path or TypeScript for everything else. Rust stays our choice for CLI tools (global rule).
