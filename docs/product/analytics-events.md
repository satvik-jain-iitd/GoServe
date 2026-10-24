# Product analytics events (PostHog), story H17

One wrapper: `app/src/lib/analytics.ts` with `track(name, props)`, `identify(id, props)`, `pageview(screen)`.
Every event also carries `app` (customer, kitchen, rider, admin), `screen`, `theme`, `env`.
A unit test fails when `track(` is called with a name not in this file. No event ships without its row.

Rules: `object_action`, snake_case. Never a name, phone or address in a property. Autocapture off. Explicit events only.
`distinct_id`: the device session id for customers (the same id the orders carry), the Google user id for staff.
Demo mode and e2e send nothing.

## Customer

| Event | Fires when | Props | Why |
|---|---|---|---|
| `app_opened` | the app loads | installed (standalone), platform | installs, iPhone share |
| `pin_submitted` | the pin form is sent | pin, served | demand by pin, no-kitchen pins |
| `menu_viewed` | the menu shows | kitchen_id, open | the funnel's first step |
| `thali_switched` | hero page changes | to: veg or non_veg | which plate people want |
| `veg_only_toggled` | header toggle | on | veg share |
| `dish_viewed` | the dish sheet opens | item_id | interest beyond the thali |
| `item_added` | Add or + | item_id, qty, price_paise, from: hero or list | basket building |
| `item_removed` | − to zero | item_id | hesitation |
| `bill_viewed` | the bill opens | items, total_paise | funnel step |
| `details_saved` | name, phone, address saved | has_address | drop before placing |
| `order_placed` | the server said yes | order_id, total_paise, items_count, kitchen_id, pin, platform | **the conversion** |
| `order_failed` | the server said no | reason | why orders fail |
| `tracker_viewed` | the slip opens | status | anxiety by status |
| `call_kitchen_tapped` | Call the kitchen | order_id, status | "where is my food" |
| `delivery_confirmed` | the delivered prompt answered | answer: yes or not_yet | hand-over truth |
| `feedback_sent` | Feedback sent | kind, has_image | problem rate |
| `push_permission` | permission answered | granted | reachability |
| `theme_changed` | You > Look | to | Night use |
| `install_prompt` | shown or accepted | result | install funnel |

## Kitchen

| Event | Fires when | Props | Why |
|---|---|---|---|
| `gate_not_staff_seen` | the gate shows | | wrong accounts |
| `ticket_accepted` | Accept | order_id, latency_s | missed or late tickets |
| `cooking_started` | Start | order_id | prep rhythm |
| `ticket_ready` | Ready | order_id, cook_s | cook time |
| `kitchen_open_toggled` | open switch | open | hours kept |
| `dish_soldout_toggled` | Sold out or back | item_id, soldout | stock |
| `tab_switched` | tab bar | to: new, cooking, kitchen | does the cook use Cooking |

## Rider

| Event | Fires when | Props | Why |
|---|---|---|---|
| `rider_online_toggled` | Me > Online | online | supply hours |
| `job_received` | a job lands | order_id, distance_m | dispatch distance |
| `pickup_confirmed` | Picked up | order_id, wait_s | kitchen hand-over wait |
| `delivered_tapped` | Delivered | order_id, door_s | on-time share |
| `not_delivered_tapped` | Not delivered | order_id, reason | refusals at the door |
| `cash_handover_marked` | hand-over at the kitchen | amount_paise | cash in hand |

No per-ping event. The 30-second location pings stay in Supabase (`rider_pings`).

## Admin

| Event | Fires when | Props | Why |
|---|---|---|---|
| `kitchen_added` | Save kitchen | kitchen_id, pins | growth |
| `person_added` | Add a person | kind | onboarding |
| `order_cancelled` | Cancel order | order_id, reason | cancellations |
| `call_tapped` | any call button | who: customer, kitchen, rider | how often the admin must call |
| `simulator_action` | Seed, Reset, Tick | action | later (H5 to H7) |

## Server side (from n8n, in SUB 14 Write logs, fire and forget)

| Event | Props | Why |
|---|---|---|
| `order_status_changed` | order_id, from, to, actor, seconds_since_placed | the full timeline per order |
| `dispatch_decided` | order_id, candidates, jev_used, agrees, ms, cost | decision quality and cost |
| `push_sent` | kind, delivered | reachability |
| `watch_alert_sent` | kind, order_id | how often the second bell rings |

Server events carry the order's session id as `distinct_id`, so client and server events join in one funnel.

## Dashboard "GoServe pilot" (created from `ops/analytics/posthog_spec.json`)

1. Funnel: `menu_viewed` → `item_added` → `bill_viewed` → `order_placed`, split by platform.
2. Funnel: `order_placed` → `order_status_changed` (to delivered), median time.
3. Trend: orders a day (breakpoint 30).
4. Trend: on-time share (`door_s` ≤ 2100 s) (breakpoint 80%).
5. Trend: late tickets (`latency_s` > 120) (breakpoint 1 a day).
6. Pie: platform share (`$os`) (breakpoint iPhone a third).
7. Retention: weekly, customers who placed an order.
8. Trend: `call_kitchen_tapped` per order (breakpoint 1 in 5).
9. Trend: `order_failed` by reason.
10. Trend: `not_delivered_tapped` by reason (breakpoint 8%).
11. Trend: events this month (free tier 1,000,000) and replays (5,000).
