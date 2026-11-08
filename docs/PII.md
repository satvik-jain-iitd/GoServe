# Personal data list

The one list of personal columns, kept honest by `scripts/test_purge_pii.py` (story #942). The purge function is `purge_deleted_accounts_v2` (migration `20261108150000_purge_pii.sql`).

## Blanked on the order (the order stays for the books)

| Column | After the purge |
|---|---|
| `orders.customer_name` | null |
| `orders.customer_phone` | null |
| `orders.address` | `[deleted]` (the column is NOT NULL) |
| `orders.drop_lat`, `orders.drop_lng` | null (the exact home point) |
| `orders.instructions` | null (the customer's note) |
| `orders.pin_code` | null |

## Rows deleted

`customers`, `addresses`, `profiles`, `feedback`, `order_tracking`, `push_outbox`, `push_devices`, `push_subscriptions` (the web push endpoint), `coupons`, `auth.users`, and the `otp_codes` for the customer's phone (their customer row and their orders).

## Not personal

`orders.session_id` (a user id, gone with the login), `orders.cancel_reason` (the kitchen's words), `orders.client_platform`. Tables that carry only the user id and no personal text (`order_events`, `run_log`, `decision_log`, `session_links`) are not purged; say so here if that changes.

## When a personal column is added

Add it to this list, to the purge function and to `PII_ORDERS` in the test. The schema test fails until all three agree.
