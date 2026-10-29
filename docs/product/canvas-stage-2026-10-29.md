# Journeys canvas by stage: every board placed by purpose (reviewer, 29 Oct 2026, canvas v122, 89 boards)

The purpose of each row:
1. Production: the screen as it is on prod today (release #687 on main, flags as deploy-app.yml sets them). The latest version only.
2. Design final, not on prod: the owner said yes; not coded yet, or coded behind a flag the prod build does not carry.
3. In discussion: no decision yet, or on hold.
4. Rejected: tried and not taken, or replaced by a later pick.
5. Mistakes, fixed: the old screen as it was when it was wrong; the note names the fix story and the row 1 board with the corrected screen.

Facts checked in code (main, 29 Oct): prod carries VITE_OTP_GATE=1 and VITE_OTP_SMS=fixed; it does not carry VITE_OFFERS or VITE_PAYMENTS_PROVIDER, so coupons and the UPI payment screens are built but not live. The kitchen New and Cooking screens use the fixed 1fr 112px grid (boards K2, K3); the older K3 and K3b boards show the bug.

| Row | Count | Boards | Why |
|---|---|---|---|
| 1 Production | 66 | Customer journey: O0 (slot 01), 02 Menu, 03 Dish, D1 (slot 04, the corrected Bill), 05 Placed, 06 Tracker, 07 Delivered, 08 Orders, Y3 (slot 09, the corrected You), 02n Night. States: 01e 02a 02b 02c 04e 08e. Rider R1 to R9. Kitchen K1, K2 gate, K2 New and K3 Cooking (fixed grid, in the New and Cooking slots), K4 K5 K6. Admin A1 to A8. Checkout code O1 to O9. Alerts U1 U2. Story row: M2 M5 M6 U3 U4 Y2 F1 F2 N1 T1 F3 O0b A1 A2 A3 | live on prod |
| 2 Design final, not on prod | 13 | L1 L2 L3 A9 (#619), T2 T3 (#691): approved 29 Oct, being coded. C1 C2 (coupons), P1 P2 P2b P4 P5 (payments): coded on staging, flag off on prod | approved, not live |
| 3 In discussion | 2 | 02s Sunset (on hold), P3 Paying (placeholder until the gateway) | no decision |
| 4 Rejected | 2 | M4 (options B and C rejected, A chosen), M3 (the earlier 3x pill, replaced by A) | not taken |
| 5 Mistakes, fixed | 6 | 01 Pin code (replaced by O0 and A1 to A3, #655: a redesign, not a bug), 04 Bill (before #659: now D1), 09 Account (before the Google row and alerts: now Y3), Y1 (before #661: now Y3), K3 New and K3b Cooking (1fr auto grid, rows jumped: now K2 K3) | the old wrong version |

Rules for later moves: a row 2 board moves to row 1 at the release that ships it or switches its flag on; the board it replaces moves to row 5 the same day (02c Kitchen closed goes to row 5 when L1 ships). A fix made on the same board (the Menu pill, option A) leaves no old board to show.

Open: the owner's word on 01 Pin code (row 5 as a redesign, or row 4); the history walk for deleted boards.

## Owner's words of 29 Oct 2026 (relayed by the reviewer)
- Sunset is row 3 (in discussion).
- K2, K3 and M3 are decided after the arrangement, not before.
- Canvas contrast: text must be readable on its background. The rule is on the ShipQuick design process page.
- The mistakes row holds the old wrong screen. The corrected screen stays in Production (row 1).

## Open questions for the owner (not decided; coder, 29 Oct 2026)
The arrangement above stands as the reviewer placed it. These four are the owner's to answer. Nothing moves until he does.
1. **01 Pin code.** Today it sits in row 5 (Mistakes, fixed). It was replaced by O0 and A1 to A3 in #655 as a redesign, not because it was wrong. Should it stay in row 5, or move to row 4 (Rejected, replaced by a later pick)?
2. **K2 and K3 (kitchen New and Cooking).** They sit in row 1 with the fixed grid, and the older K3 and K3b sit in row 5. Do you agree with this split, or do you want K2 and K3 placed differently once you see the whole canvas?
3. **M3 (the earlier 3x pill).** Today it sits in row 4, replaced by option A. Keep it in row 4, or does it belong in row 5?
4. **History walk.** The brief asks for deleted boards to be recovered from the canvas history, each with a one-line decision and a date. The coder cannot open old versions of the canvas, so this needs the reviewer's editor access. Which deleted boards do you want back, and should the recovered ones go to row 4 or row 5?
