# MVP 2 closure (24 Oct 2026)

MVP 2 is the whole system for a cash pilot: one city, 10 kitchens, 20 riders, 100 customers.

## What MVP 2 added

| Item | Layer | Proof |
|---|---|---|
| City data model, roles, kitchen pin codes (ADR-017) | A1, PR #162 | `scripts/check_city_model.py dev`, 86 of 86 checks |
| Admin app: kitchens, staff, menu with photos, orders, cancel, day numbers | A2 to A4 | `admin.spec.ts` |
| Customer: pin code, details, estimate, cancel, history, draft | B1 to B3 | `area.spec.ts`, `profile.spec.ts` |
| Dispatch: nearest free rider assigned by n8n | A5 | live on dev: assigned; no rider gives an alert |
| Kitchen sold out and open or closed | A6 | `kitchen-controls.spec.ts` |
| Web push with no text, VAPID | A7 | live on dev: Sign, Send, Forget |
| Design system and new screens, rider card | D1 to D3 | `ui.test.ts`, `customer-ui.spec.ts`, `staff-ui.spec.ts` |
| Scale proof on dev | A5 | `orders=100 lost=0 duplicates=0 wrong_kitchen=0 unassigned=0` |

## Done on prod (23 Oct 2026, with the owner's yes, read back)

- Migrations 0012 to 0021 applied one at a time. Release #175 merged.
- Admin, rider, kitchen and customer rows for the owner's account.

## Still to do (owner steps, each on a yes)

- Prod n8n deploy and activate, the VAPID credential check, and the VAPID public key in the prod build (the prod workflow does not pass it yet).
- The admin row for the founder's second account and the roles for the other founder, after they sign in once.
- Live rows on phones: kitchen, rider, customer, push on iPhone.
- The blind pick (old look or new look) and the investor walk (`docs/product/investor-walk.md`).
- Google brand verification (F116) and the real pilot pin codes.

## Cost

About $0 a month so far. Jev costs about $0.00002 a call. Push is free.

## Lessons

See `docs/LEARNINGS.md` rows added on 23 Oct.
