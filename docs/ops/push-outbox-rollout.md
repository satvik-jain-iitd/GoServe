# Push outbox re-offer: rollout order (stories #534 and #693)

Owner runs both steps. The reviewer reads them first. Order matters.

## Why
Migration `0047_push_outbox_reoffer.sql` offers a push row again if it was taken more than 2 minutes ago and is not marked sent. At most 3 times. Then it is dead-lettered and `order_trace` gets a `push_dead` line.
n8n MAIN 34 marks the rows it sent (`Sent ids`, then `Mark sent`). If 0047 comes first, every push that was sent is sent again, up to 3 times.

## Order
1. Deploy MAIN 34 to the prod n8n (the existing deploy in `ops/n8n/order`). Until step 2 the `Mark sent` call answers 404. That does not stop the run.
2. THEN apply 0047 on prod: `scripts/apply_migration.py <prod ref> app/supabase/migrations/0047_push_outbox_reoffer.sql`.
3. THEN apply 0048 on prod (story #187, the field rules on `customers` and `orders.address`): `scripts/apply_migration.py <prod ref> app/supabase/migrations/0048_field_rules.sql`. It is additive and `NOT VALID`: old rows are not checked.
4. Never the other way round. The list is one list: MAIN 34, 0047, 0048.

## Known and accepted for the test phase
If SUB 20 fails part-way through a batch, the rows it did send are not marked. They are offered once more, and the cap of 3 limits it. A customer may get a repeat push in that case.

## Check after the run
- [ ] Place a test order. One push arrives, not two.
- [ ] `select count(*) from push_outbox where sent_at is not null` grows.
- [ ] `select count(*) from order_trace where event = 'push_dead'` stays 0.
