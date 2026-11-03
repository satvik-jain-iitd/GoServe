# Design principles v2 and the Living Slip (story #331, plan v2 D.5)

Seven rules for how GoServe looks and moves. One big idea: the Living Slip.
They come from the notes in `research-2026-10.md` (Apple), `research-android-2026-10.md` (Material and Android) and `../research/journeys-swish-zepto-2026-10.md`. Read the gaps there before you lean on a number.

## The seven rules

1. **The most important thing comes first.** One line at the top: the time, or the status. Address and bill sit below it. Extras sit behind a tap.
2. **One slip.** An order is one slip, from the cart to the lock screen. We do not show it as many screens that each say a little.
3. **Show little. Open on tap.** A screen shows what you need now. The rest opens when you ask.
4. **Motion is rare, and it can be turned off.** A moment that happens once (the stamp landing on the slip) may move. Tapping Add many times must not. Under two seconds. Respect "reduce motion".
5. **A buzz is a small word.** One haptic when the order is placed and one when it is delivered. A light tick while you change a number. None anywhere else.
6. **Everyone can read it.** Big tap targets (48 to be safe on Apple and Android). Text no smaller than 12. No thin weights. Every state has words and an icon, never only a colour. Check Day and Night.
7. **One look on every phone.** The GoServe Ink look (tokens in `design/tokens.json`) is the same on the web app and the Android app. The platform may add its own lock screen part.

## The Living Slip

The slip that lives outside the app.

- It shows the same four steps on the lock screen: **Placed, Cooking, On the way, Delivered.**
- It ends at **Delivered**. No hanging slip.
- On iPhone it is a Live Activity. On Android it is a Live Update (a standard notification style, not a custom picture).
- It also carries the honest time and the on-time promise, in plain words.
- Small version: it must fit in a small circle.
- At most two seconds of motion.

## Not decided yet (owner)

- Whether the new look uses Apple's Liquid Glass on iPhone, or our flat Ink style on both phones (research note D.10).
- Material motion values, Android layout and insets: not read yet (the gaps in the Android note).
- Nothing here is measured on a phone. Each rule is a hypothesis until a screen shows it.

## The owner's design feedback, dated

Kept here the same day he says it, and sent to ShipQuick so every project gets it.

**3 November 2026, story #829, the welcome screen with one button.** He picked board
`O0g-B-GoogleFirst` and rejected `O0g-A-GoogleOnly`. His reason, in his own words: A looked basic, the
sign-in screen most apps already have, exactly as it is. Nothing new. Not engaging enough for the
customer, because the messages around the button did not feel personalised.

The rule this leaves behind:

8. **On a screen whose job is one action, the copy is the design.** When a screen has one button, the
   words around it are everything else on it. Options put to the owner must differ in their words, not
   only in their layout. Text that could be pasted into any other app unchanged is the default, and the
   default is not a design. Sent to ShipQuick as feedback #148.

## Not in this page

- The design is not drawn. Per the owner's rule of 29 Oct: two or three frames first, his feedback, then screens, two or three at a time.
