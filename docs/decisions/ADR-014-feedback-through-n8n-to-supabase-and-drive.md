# ADR-014: Feedback goes to Supabase and Google Drive through n8n

## Status

Proposed (story S-B, #94). The owner accepts it by merging the pull request.

## Date

2026-10-15.

## Context

Testers who are not technical must be able to tell us what went wrong without leaving the app. We want every report in one place we can count, the screenshot in Google Drive, and a message on Telegram at once. The phone holds no secrets (ADR-009), and writes go through n8n (rulebook B11).

## Decision

1. A **Feedback** button on every screen opens a sheet: what happened, what the tester was doing, an optional screenshot. The app adds the role, the screen, the session, the order, the build, the phone, online or offline, the time and the last 20 taps.
2. The picture is the phone's own screenshot, picked from the gallery. No screenshot library. The app shrinks it to at most 1280 px and 1.5 MB.
3. The phone posts action `feedback` to MAIN 01 with the demo token. MAIN 01 calls the new **GS SUB 17 Feedback**, which has its own write path.
4. SUB 17 writes one row to the new `feedback` table (migration 0008, service role only, RLS on, no policy). If this write fails, nothing else happens (502).
5. Then, as best effort: upload the picture to the Google Drive folder (credential `Klickbae8yt@gmail.com`, folder `GoServe UAT/dev` or `/prod`), link the file id to the row, send one Telegram message (GoServeBot, the owner chat).
6. An offline phone keeps the report in `localStorage` (queue of 5) and sends it when the app opens or the phone is back online.
7. The Drive folder id lives in the MAIN 01 Config (`drive_folder_id`), set at deploy time from the vault.

## Consequences

- Reports can be counted with one query. The owner reads Telegram and Drive; there is no admin screen.
- The table is private. The phone cannot read its own reports back.
- A report can contain what the tester typed and their screen. We do not ask for names. The guide tells testers not to type personal data.
- The prod copy of SUB 17 is deployed inactive until the owner says yes. Prod needs migration 0008 first (`release_db.py` only fits an empty database, so use `apply_migration.py` for prod).
- No rate limit yet: the demo token is in the app, so someone could send many reports. Added to the follow-ups (F64 / F65 group).
