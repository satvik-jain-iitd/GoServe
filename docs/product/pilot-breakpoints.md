# Pilot breakpoints (reviewer's estimates, 24 Oct 2026)

One kitchen, a few pin codes, cash at the door, PWA only, the cook's and the riders' own phones.
Every number below is an estimate (score 0 to 1 = how sure). The pilot's own numbers replace them in week one.
Green = fine. Breakpoint = the first day it is crossed, we act.

| What we measure | Green | Breakpoint | What breaks there | What we do | Score |
|---|---|---|---|---|---|
| Orders a day, one kitchen | up to 20 | 30 | One cook, one phone: tickets pile up at dinner, the thali batch runs out | Second cook or a second kitchen; the ten-kitchen step | 0.6 |
| Tickets in the busiest hour | up to 6 | 10 | The web ring on a personal phone misses one; accept within 2 min fails | Plugged-in kitchen device, then the kiosk wrapper | 0.6 |
| Missed or late-seen tickets a day | 0 | 1 | A customer waits with no cooking started | Telegram second bell first; kiosk wrapper if it still misses | 0.8 |
| Deliveries an hour per online rider | up to 3 | 4 | The 25 to 35 minute promise slips; one rider cannot chain more in a 2 to 3 km radius | Second rider online at dinner; dispatch already picks the nearest | 0.7 |
| Radius from the kitchen | up to 2.5 km, 2 pin codes | 3.5 km or 4 pin codes | Ride time alone passes 15 minutes; food cools | Stop adding pins; open the next kitchen instead | 0.7 |
| Delivered inside the promised minutes | 90% and up | under 80% for 3 days | Customers stop believing the number | Shorten the radius, add a rider, or widen the promise honestly | 0.7 |
| Rider location gaps (screen off) | under 2 min a delivery | over 5 min on 1 in 5 deliveries | ETA and nearest-rider wrong; live map impossible | Wake Lock rule first; Capacitor rider app when live tracking is promised | 0.8 |
| Cash in a rider's pocket per shift | up to ₹5,000 | ₹8,000 | Theft and change problems; hand-over disputes | Mid-shift hand-over at the kitchen; payments sooner | 0.5 |
| Cash refused at the door | under 3% | 8% | Food wasted, rider's time lost | Phone confirm before cooking; prepay for repeat offenders; payments | 0.5 |
| iPhone share of orders | under 25% | a third | Missed ready and at-the-door pings, lost storage after a week | Add to Home Screen line first; SMS or WhatsApp next | 0.7 |
| Repeat customers who lost their orders list or address | 0 a week | 2 a week | Zero login's browser storage is the problem | Phone number + OTP login (MVP 2b) | 0.7 |
| "Where is my food" calls | under 1 in 10 orders | 1 in 5 | Status words are not enough | Push and SMS first; live map later | 0.6 |
| Realtime connections open at once (Supabase free tier) | under 50 | 200 | New kitchen and rider screens stop updating live | Paid tier or polling fallback | 0.7 |
| Pilot length | 3 to 4 weeks or 300 orders | whichever first | Enough orders to read the numbers above | Decide the ten-kitchen step on the table, not on feel | 0.8 |

Three numbers read every day: missed tickets, deliveries inside the promise, location gaps. Everything else weekly.
