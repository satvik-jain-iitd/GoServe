# Push outbox re-offer: rollout order (stories #534 and #693)

Owner runs both steps. The reviewer reads them first. Order matters.

## Why
Migration `0047_push_outbox_reoffer.sql` offers a push row again if it was taken more than 2 minutes ago and is not marked sent. At most 3 times. Then it is dead-lettered and `order_trace` gets a `push_dead` line.
n8n MAIN 34 marks the rows it sent (`Sent ids`, then `Mark sent`). If 0047 comes first, every push that was sent is sent again, up to 3 times.

## Order
1. Deploy MAIN 34 to the prod n8n (the existing deploy in `ops/n8n/order`). Until step 2 the `Mark sent` call answers 404. That does not stop the run.
2. THEN apply 0047 on prod: `scripts/apply_migration.py <prod ref> app/supabase/migrations/0047_push_outbox_reoffer.sql`.
3. THEN apply 0048 on prod (story #187, the field rules on `customers` and `orders.address`): `scripts/apply_migration.py <prod ref> app/supabase/migrations/0048_field_rules.sql`. It is additive and `NOT VALID`: old rows are not checked.
4. THEN the #619 migrations, in this order (all additive): `app/supabase/migrations/0049_realtime_menu.sql` (kitchens and menu_items in realtime), `supabase/migrations/20261029100000_settings.sql` and `supabase/migrations/20261029110000_settings_admin.sql` (swap discount; the quote and orders functions read it, so deploy them after), each with `scripts/apply_migration.py <prod ref> <file>`.
5. BEFORE 0050 (story #718, "Tell me when it opens"): deploy MAIN 34 and SUB 20 again (the new Guard accepts status `open`, Expand passes `kind`). THEN apply `app/supabase/migrations/0050_open_alerts.sql`. If 0050 comes first, a `kitchen_open` row reaches the old Guard and no push goes out.
6. Never the other way round. The list is one list: MAIN 34, 0047, 0048, 0049, settings, settings_admin, then MAIN 34 and SUB 20 again, then 0050.

## Known and accepted for the test phase
If SUB 20 fails part-way through a batch, the rows it did send are not marked. They are offered once more, and the cap of 3 limits it. A customer may get a repeat push in that case.

## Check after the run
- [ ] Place a test order. One push arrives, not two.
- [ ] `select count(*) from push_outbox where sent_at is not null` grows.
- [ ] `select count(*) from order_trace where event = 'push_dead'` stays 0.

## Done (owner, 29 Oct 2026, about 15:30 IST)
`deploy.js --env prod --apply` updated all 27 PROD workflows in one run (the first try stopped on a Cloudflare 520 page; a shell loop of 5 tries, 60 s apart, finished it). Then 0047, 0048, 0049, `20261029100000_settings`, `20261029110000_settings_admin` and 0050 through `apply_migration.py`, each answered `[]`. Then `supabase functions deploy quote` on prod (quote reads the settings). Checks after: `push_outbox` rows with `sent_at` set: 5 (Mark sent works on prod); `push_dead`: 0; settings rows: 1.
