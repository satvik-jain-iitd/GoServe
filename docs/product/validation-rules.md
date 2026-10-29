# Validation rules (story #187, H4)

The database is the truth. The Edge Functions and the app mirror it, so a bad value is refused in all three places with a plain message.
Tests: `scripts/test_validation.py` (database, needs the dev token), `supabase/functions/validation.test.ts` (Edge Functions), `app/tests/unit/validation-rules.test.ts` (app).
Migration `app/supabase/migrations/0048_field_rules.sql` added the database rules that were missing. They are `NOT VALID`: old rows are not checked, every new or changed row is.

| Field | Rule | Database | Edge Function | App | Message the customer sees |
|---|---|---|---|---|---|
| Phone | ten digits, starts with 6, 7, 8 or 9 | `customers_phone_rule`; `otp_send_v2` answers `invalid_phone` | the sign-in function answers `invalid_phone` | `isPhone` (Bill), `isMobile` (sign-in sheet) | "Enter a ten digit mobile number." |
| Name | 1 to 80 characters | `customers_name_rule` | none (the name does not travel through an Edge Function) | `maxLength` 80 on the Bill | The box stops typing |
| Address text | 1 to 300 characters | `orders_address_rule`, `customers_address_rule`; `place_order_v2` refuses empty (`invalid_address`) | `POST /orders` answers 400 | `maxLength` 300; Place order stays off while empty | "Add a delivery address." |
| Pin code | six digits | `customers_pin_rule`; kitchen pin lists are checked in migration 0022 | `POST /quote` and `POST /orders` answer 400 | `isPin` | "Pin codes are six digits." |
| Quantity of a dish | 1 to 20 | `place_order_v2` answers `invalid_quantity` | `quote()` answers `invalid_quantity` | `MAX_QTY` 20 | "Pick 1 to 20 of a dish." |
| Lines in a cart | at most 30 | none | `parse()` refuses more than 30 | none | (not reachable from the app) |
| Coupon code | upper case, 2 to 40 characters | `coupons.code` check | `parse()` refuses over 40, trims and upper-cases | `maxLength` 40; the box upper-cases | "<CODE> is not a valid code." |
| Feedback text | 1 to 2000 characters in the database | `feedback_text_check` | none | stops at 300 (`TEXT_MAX`) | The box stops typing |

## Differences on purpose
- Feedback text: the app stops at 300, the database allows 2000. The app is stricter to keep a note short. A second app or a script may send up to 2000.
- A customer's name, phone, address and pin are saved straight to `customers` from the phone, so the database rule is the only server check for them. The order itself takes its address from the Bill.

## Found while writing the table (29 Oct 2026)
- The Bill accepted a phone that starts with 0 to 5 (`^\d{10}$`) while the sign-in sheet and the code sender refused it. The Bill now uses the same rule.
- `customers` and `orders.address` had no database rule at all. Migration 0048 adds them.
