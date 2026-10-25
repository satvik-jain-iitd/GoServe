# Phone test list

The owner runs every phone test together, at the end, from this one list. Each test has steps, what to look for, and the line the reviewer runs after it. New tests are added here as they appear.

## P1. Rider app keeps sending its place with the screen locked (#252, E-TWA-1)

Why: a web app may stop in the background. If the rider app stops pinging, we must build a foreground service (ADR-020). If it keeps pinging, we do not.

Steps:
1. Install `~/Downloads/goserve-rider-spike.apk` (package `in.goserve.rider`) on an Android phone.
2. Open it and sign in as a rider on the prod app.
3. Go online. Accept the location question with "While using the app" or "Always".
4. Lock the screen. Leave the phone for 20 minutes. Do not open any other app.
5. Unlock. Tell the reviewer "ho gaya".

What to look for: nothing on the phone. The proof is in the database.

Reviewer runs after it (the owner's yes is needed for prod):
`python3 scripts/rider_gap.py prod --yes-prod --minutes 25`

Result: PASS when the longest gap between two pings is 60 seconds or less. FAIL means the foreground service is needed. Record the result in `docs/research/experiments.md` row E-TWA-1.
