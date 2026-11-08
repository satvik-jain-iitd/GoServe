# Swish onboarding, frame by frame (owner's screen recording, 8 Nov 2026)

Source: owner's own phone recording, 62 s, iPhone, Swish "10-Min Food Delivery" (Munchmart Technologies). Tier S (owner's own capture of a live app). Contact sheets: `sheet_00.jpg` to `sheet_07.jpg` (one frame a second, time in red).

## The journey in one line
Store -> splash -> hero + login sheet -> (iOS tracking ask) -> location pre-ask sheet -> (iOS notifications ask) -> number -> code -> "location is off" fallback -> pick a place -> location pre-ask again -> iOS location ask -> home, which says "Unserviceable area" and turns into "Coming soon to your neighbourhood".

## Frames
| # | Time | Frame | Layout | Options given | Observation |
|---|---|---|---|---|---|
| 1 | 0-1 s | App Store page | Store listing | Open | Not part of the app. |
| 2 | 2-3 s | Splash | Full green, white logo, "10-minute food delivery", "Made fresh, delivered fast" at the foot | none | One brand moment, about 1 s. |
| 3 | 4 s | Hero + login sheet | Top 55%: a food photo (a glass of chai) with the promise "From your next-door kitchen, in 10 mins"; Skip top right. Bottom sheet: "Log in with your number", +91 field, "We'll send a verification code here", Continue (grey until valid), legal line | Type number, Skip | The promise and the login share one screen. The photo sells; the sheet works. |
| 4 | 5-6 s | iOS "Allow tracking?" | System alert over the location sheet | Ask not to track, Allow | Asked before any value. Do not copy. |
| 5 | 7-10 s | Location pre-ask sheet | Sheet with a pin-on-map drawing, "Allow Location Access", one reason: "to find the kitchen nearest to you and deliver to your doorstep" | Skip, Continue (green, equal width) | A soft ask before the system ask, with the reason. The user skipped here. |
| 6 | 11-12 s | iOS notifications ask | System alert over the login sheet | Don't allow, Allow | Asked before any value. Do not copy. |
| 7 | 13-20 s | Number | Login sheet rises with the number pad; number typed as 10 digits, no space; Continue turns green only at 10 digits | Continue | Button sleeps until the field is valid (same rule as ours). |
| 8 | 21-27 s | Code | Full white page: back arrow; a rotating trust pill on top ("50% off on first order", then "Trusted by 5L+ people"); "A verification code has been sent to [phone masked]" (number in green); one field with 6 dots; Continue; "Resend OTP in 0:29" countdown; SMS and WhatsApp resend chips; the code is auto-filled from Messages | Continue, resend by SMS or WhatsApp, back | Trust and offer sit on the wait screen. Two resend channels. |
| 9 | 28-37 s | "Location permission is off" | A sheet over a grey home skeleton: icon, "Location permission is off", "Please enable location permission for a better delivery experience", Continue; below: "Select your address" + View all, the saved "Office" row, "Search your location" button | Turn on location, pick a saved address, search | Never a dead end: three ways forward on one sheet. |
| 10 | 38-39 s | "Select a location" | Full page: search field, "Use current location" button, "Saved Delivery Address" list | Search, current location, saved row | The same three ways as a page. |
| 11 | 40-44 s | Pre-ask again, then iOS location ask | The same sheet as frame 5, then the system alert | Skip, Continue | The soft ask appears again when the user asks for current location. |
| 12 | 45 s | Finding | Three dots under the search field | none | Short wait, no text. |
| 13 | 46-61 s | Home, unserviceable | Header: "Unserviceable area" in bold, the current place below ("Green Avenue Colony" with an arrow icon and a chevron to switch); an "Earn ₹250" referral chip; profile circle. Body: "Coming soon to your neighbourhood" with a rider drawing; "Request Swish in your area"; "Need help? · Get updates on Instagram" | Request in your area, switch address, profile, referral | The whole home becomes the empty state. The header still lets the user switch address. The phone's current place won over the saved Office (Koramangala). |

## What this means for GoServe
1. **The phone's place wins on open.** Swish used the live location (Green Avenue Colony), not the saved "Office", and printed it in the header with a switcher. This answers the far-address question: the header always shows where the food will go, so a moved customer sees it before he browses.
2. **Soft ask before the system ask**, with one reason in plain words, and Skip allowed. Our A1 already does this ("Where does the food go?").
3. **Permission off is never a dead end**: saved addresses and search sit on the same sheet.
4. **The code screen carries trust**: offer or social proof on top, countdown, two resend channels, auto-fill.
5. **Unserviceable is a whole-home state**, not an error line, with one action ("Request Swish in your area") = our NK-A "Tell me when you come here".
6. **Do not copy**: the tracking ask and the notifications ask before any value; the location pre-ask shown twice.
