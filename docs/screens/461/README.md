# Simulator tab, before and after (story #461)

Taken with Playwright on the test build, admin screens, 390 px wide and 1200 px wide, Day and Night. `reference-City-*` is the well-built screen to match.

Gaps found before the fix:
- Fields were the browser's thin white box (21 px high, no Ink border, no radius). The City forms use `ui-form`: full tap height, Ink border, a gap between fields.
- The label of the next field touched the box above it. `ui-form` puts a token gap (`--gs-space-4`) between fields.
- "Seed the city" and "Save the scenario" touched the last field. `ui-form-acts` puts a token gap above the button.
- "Tick now" and "Reset the city" were full-width big buttons. On City the side buttons are plain ghost buttons (`--gs-tap` high) in `ui-pad-y`.
- The help line sat on the button. It now sits inside the form, one token gap below.
- Switch rows already used `ui-row`, like City; unchanged.
