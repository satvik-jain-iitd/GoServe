# Go Serve — MVP 0: Clickable Demo — Build Spec

**Date:** 11 Oct 2026
**Due:** 18 Oct 2026 (7 days)
**Plain English.** This is the plan for the first thing we show. It is a plan, not code.

---

## 1. What MVP 0 is

One PWA link that looks and feels like a mobile app. It walks through the full journey of one order, end to end, with a real backend saving the order and a real screen showing it move from placed to delivered.

The point of MVP 0 is to prove three things:

1. The idea works.
2. The screens feel like a real product, not a mockup.
3. We can wire backend to frontend, so the next step is more screens, not new plumbing.

MVP 0 is not a product. It is one working order on a real backend, built on the same shape as the final system so nothing is thrown away.

---

## 2. What "done" means (definition of done)

MVP 0 is done when:

1. There is one link. Opening it on a phone shows an app-like screen with no browser chrome tricks, saved to the home screen.
2. A person can tap through the full path: browse menu, add to cart, see the bill, place an order.
3. Instead of paying, the order is placed as pay-later, but it is saved for real in the database.
4. The kitchen screen shows that order, without a refresh. It arrives by itself.
5. Kitchen taps Accept, Start, Ready. Each tap moves the order, and every other screen sees the move live.
6. The customer screen shows the status change as it happens.
7. The whole demo works on one phone plus one laptop, on the same link.

If all seven are true, MVP 0 is done.

---

## 3. What is real and what is faked

We are honest about this. Real backend, real order, real state. Faked only where the outside world needs money or approvals we do not have yet.

| Part | Real or faked in MVP 0 | Note |
|---|---|---|
| PWA screens | Real | Built properly on the final design system. |
| Menu and prices | Real data | Seeded into the database. |
| Cart and bill | Real | Real math, real state. |
| Login | Faked | One-tap demo login. Real OTP comes in MVP 1. |
| Payment | Faked | Pay-later button. Real payment needs KYC. |
| Order saved | Real | Written to Postgres. |
| Kitchen screen | Real | Reads the same database. |
| Live updates | Real | Real-time channel, not polling. |
| Rider step | Faked | A button that plays the rider, or skipped. |
| Jev decisions | Not in MVP 0 | Placeholder text only. Jev starts in MVP 1. |
| Notifications (SMS / WhatsApp) | Faked | On-screen only. Real senders need approvals. |

The rule: everything inside our four walls is real. Only the outside gates are faked, and each one is clearly labelled as demo.

---

## 4. The screens (seven)

All screens are responsive, Material Design 3, and live inside one PWA.

1. **Home / menu.** List of dishes with photo, name, price. Tap to open a dish.
2. **Dish detail.** Photo, description, price, add to cart.
3. **Cart.** Items, quantity, running total, address box, place order.
4. **Bill / confirm.** Items, taxes, delivery fee, total, pay-later button.
5. **Order status (customer).** A simple tracker: placed, accepted, cooking, ready, out for delivery, delivered. Updates live.
6. **Kitchen display.** A list of incoming orders. Each has Accept, Start, Ready buttons. New orders appear live.
7. **Ops stub (optional).** A plain list of all orders today. Nice to show, not required.

Three roles, one link. The app knows who you are from the demo login and shows the right screen.

---

## 5. The click path (the one order)

This is the exact path the demo follows. Every step is a real screen or a real backend event.

1. Open the link. See the menu. (Screens 1 to 4)
2. Add two dishes. See cart and bill.
3. Tap Place Order. Backend writes the order. Status is `placed`.
4. Backend fires `order.placed`. Kitchen screen shows the order, live.
5. Kitchen taps Accept. Backend fires `order.accepted`. Customer screen updates, live.
6. Kitchen taps Start. Backend fires `order.preparing`. Customer screen updates.
7. Kitchen taps Ready. Backend fires `order.ready`. Customer screen updates.
8. (V1 rider step, faked) Ops taps Out for delivery and Delivered. Customer sees delivered.
9. Customer taps Rate. A thank-you screen. Done.

One order, full loop, both ends watching it move.

---

## 6. The backend for MVP 0

We use n8n as the backend for MVP 0. It is already running on the Oracle server. It lets us wire webhooks to the database without writing a server, which is exactly what a 7-day demo needs.

### 6.1 The shape matters more than the tool

n8n is the fast path. The final system will be a real API service. So we freeze the API paths and event names now, and build n8n to match them. When we replace n8n with the real API, the PWA does not change. Only the backend changes.

This is the one rule that keeps MVP 0 from becoming throwaway.

### 6.2 API paths (frozen now)

| Method | Path | Job |
|---|---|---|
| GET | `/api/menu` | Return the dish list. |
| POST | `/api/order` | Place a new order. Body has items, address. |
| GET | `/api/order/:id` | Return one order and its status. |
| GET | `/api/orders` | Return today's orders (kitchen and ops). |
| POST | `/api/order/:id/status` | Move an order to the next status. |
| GET | `/api/events/stream` | Live updates (server-sent events). |

### 6.3 Event names (frozen now)

`order.placed`, `order.accepted`, `order.preparing`, `order.ready`, `order.rider_assigned`, `order.picked_up`, `order.arriving`, `order.delivered`, `order.rated`.

These match the solutioning document exactly. Do not invent new names in MVP 0.

### 6.4 n8n workflows (four)

1. **menu** — Webhook `GET /api/menu` reads a menu table (or a fixed JSON) and returns the list.
2. **place-order** — Webhook `POST /api/order`. Validates items, writes a row to the orders table with status `placed`, writes the status history, fires the live event. Returns the order id.
3. **list-orders** — Webhook `GET /api/orders` and `GET /api/order/:id`. Reads the orders table.
4. **set-status** — Webhook `POST /api/order/:id/status`. Validates the next status is legal, updates the row, appends to history, fires the live event.

### 6.5 Live updates

The simplest reliable choice for the demo is Server-Sent Events, one open connection per screen. When an order changes, the backend pushes the new status. The screen updates with no refresh. If SSE is awkward in n8n, fall back to a 2-second poll, but keep the same endpoint name so the swap is clean.

### 6.6 Data stored (minimum)

One `orders` table:

| Column | Type | Note |
|---|---|---|
| id | text | Our order id, e.g. ORD-1001. |
| status | text | placed, accepted, preparing, ready, delivered. |
| items | json | The line items. |
| total | number | Rupees. |
| address | text | Delivery address. |
| created_at | timestamp | When placed. |
| updated_at | timestamp | Last change. |

One `order_events` table: order id, event name, timestamp. This is the history, so we can always show the timeline.

---

## 7. The frontend for MVP 0

One PWA. Next.js with Material Design 3, matching the solutioning document. Rules:

1. One codebase. Screens differ by role, not by app.
2. The browser only shows screens and calls the API. No logic in the browser.
3. Mobile first. The customer and rider views assume a phone. Kitchen assumes a tablet.
4. Installable. Add a manifest and a service worker so it can be added to the home screen.
5. Same API paths as the final system. Nothing hard-coded that we would have to undo.

---

## 8. The 7-day plan

AI-speed build. Each day ends with something visible.

| Day | Date | Focus | End-of-day result |
|---|---|---|---|
| 1 | 12 Oct | Freeze the shape | API paths and event names locked. Menu data ready. |
| 2 | 13 Oct | PWA shell | Home and dish screens open on a phone, look like an app. |
| 3 | 14 Oct | Cart and bill | Add to cart, see the bill, reach Place Order. |
| 4 | 15 Oct | Backend up | n8n writes a real order to Postgres. |
| 5 | 16 Oct | Kitchen screen | Order appears live. Accept, Start, Ready work. |
| 6 | 17 Oct | Live status | Customer screen updates live as kitchen taps. |
| 7 | 18 Oct | Polish and demo | Full loop smooth on phone plus laptop. Demo recorded. |

The bottlenecks are not coding. They are waiting on outside approvals, which do not block MVP 0 at all, because MVP 0 uses no paid or gated services.

---

## 9. Acceptance checklist

Before we call MVP 0 done:

1. One link opens and looks like an app on a phone.
2. Full path works: menu, cart, bill, place order.
3. The order is really saved in Postgres (checked by reading the row).
4. Kitchen screen shows the order live, no refresh.
5. Accept, Start, Ready each move the order and update history.
6. Customer screen shows the same moves live.
7. No code calls a paid service. No secret is in the PWA.
8. API paths and event names in the app match the frozen list in section 6.

---

## 10. What MVP 0 proves for what comes next

MVP 0 sets up MVP 1, the golden path. In MVP 1 we add real login, real payment, the rider step, and Jev D1 to D5 behind the same frozen API. Because the paths and event names already match, MVP 1 is more screens and more logic, not a rewrite.

MVP 0 is small on purpose. One order. One link. One real backend. If that works, the rest is repetition.
