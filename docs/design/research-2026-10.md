# Apple Human Interface Guidelines: notes for GoServe

Story #327 (D.1, epic E26). These notes feed the design principles (D.5) and the Living Slip.

**Read:** 27 Oct 2026. The Apple pages are scripts: a plain page fetch returned only the page title, and a model's answer from memory is not a reading, so none was used. The text and the tables come from Apple's own data files for each page (`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`), the same text the page shows. Quotes below are short and exact.

**How to trust this.** Tier A: Apple wrote it, so it is true that "Apple says this". Apple sells phones, so a rule can also serve Apple (more apps that look like its apps, more use of its features). It does not prove the rule is best for a food app: that needs our own test (principle 5 of the owner). Confidence is for "Apple says this and it is current" (the pages mention Liquid Glass, the new look, and a change log up to Dec 2025).

## Hierarchy

Source: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), section Visual hierarchy. Tier A. Confidence 0.9.

- "Order content by relative importance." People read from top to bottom and from the leading side, so the most important item goes at the top and leading side.
- Align items to make them easy to scan; indent to show that an item belongs under the one before it.
- Group related items with space, a container or a line.
- Use progressive disclosure: show a little first, more on tap. "Too much content and too many choices" slows people down.
- Show controls apart from content.

For GoServe: one order slip, the most important line (the time or the status stamp) at the top; address and bill below; extras behind a tap.

## Layout

Source: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), sections Adaptability, Size classes, Guides and safe areas. Tier A. Confidence 0.9.

- Layouts must adapt to screen size, turning the phone, text size and language. Use the system layout tools, not fixed sizes.
- "Determine layout based on size classes, not device type or orientation."
- Keep the same functions at every size; change only how much shows at once.
- Respect the safe area, so the Dynamic Island and bars never cover a control.
- Test the largest and the smallest layout first, and with big text.

For GoServe: the native apps use the platform layout tools. The PWA is frozen.

## Type

Source: [Typography](https://developer.apple.com/design/human-interface-guidelines/typography). Tier A. Confidence 0.9.

- iPhone body text is 17 pt by default and 11 pt is the smallest size (Apple's table). The iOS styles: Large Title 34, Title 1 28, Title 2 22, Title 3 20, Headline 17 (semibold), Body 17, Callout 16, Subhead 15, Footnote 13, Caption 1 12, Caption 2 11.
- "Avoid light font weights": prefer Regular, Medium, Semibold or Bold. Not Ultralight, Thin or Light.
- Show hierarchy with weight, size and colour. Use few typefaces.
- Support Dynamic Type: text must work at every size, including the large accessibility sizes. "Keep text truncation to a minimum." Stack items vertically when width is short. Keep the same hierarchy at any size.
- Icons that carry meaning must grow with the text.
- System font on iPhone: SF Pro. A custom font must stay legible and follow the minimum sizes.

For GoServe: the Ink v4 tokens (D.6) keep Bricolage, Anek and DM Mono, so each needs a size ladder that follows these minimums and scales with Dynamic Type (Android: font scale).

## Motion

Source: [Motion](https://developer.apple.com/design/human-interface-guidelines/motion). Tier A. Confidence 0.9.

- "Add motion purposefully": no animation for its own sake.
- "Make motion optional": never the only way to show something important; add haptics or sound.
- Feedback motion follows the gesture; keep it brief and exact.
- Avoid motion on interactions that happen often.
- "Let people cancel motion": do not make people wait for an animation to end.
- Be careful with fast or blinking animation; with Reduce Motion on, tighten springs and cut bounce (Accessibility page).

For GoServe: the stamp that lands on the slip is a rare moment, so it may animate. Tapping Add many times must not.

## Haptics

Source: [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics). Tier A. Confidence 0.9.

- Use the system patterns for what they mean: Notification (the outcome of a task), Impact (a physical tap, for example a view snapping in place), Selection (a value changing).
- Use haptics the same way everywhere, so each one means one cause.
- "Prefer using haptics to complement other feedback", never alone.
- Do not overuse: "the best haptic experience is one that people may not be conscious of, but miss when it's turned off."
- Prefer short haptics for single events. Make them optional.

For GoServe: one Notification haptic when the order is placed and when it is delivered; Selection while changing quantity; none elsewhere.

## Live Activities

Source: [Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities). Tier A. Confidence 0.9.

- Offer one for a task with a start and an end, "don't exceed eight hours". Apple's own example is "the remaining time until a food delivery order arrives".
- Show only what is important at a glance. Tap opens the app at the right place.
- No ads. No sensitive information on a Lock Screen that others can see.
- Four presentations: compact and minimal (Dynamic Island), expanded (touch and hold), Lock Screen (also StandBy and the Mac menu bar). Compact and minimal must fit in a 28 pt circle in narrow cases.
- Large, heavier text: "medium weight or higher". Match the app's look in light and dark. A logo mark goes without a container.
- Animations last at most two seconds; none on a dimmed always-on screen.
- Update only when something new is known. Alert only for essential updates.
- "Always end a Live Activity immediately when the task or event ends." On the Lock Screen it can stay up to four hours, so show a final state such as Delivered.
- Interaction: simple, direct actions only (for example contact the driver).

For GoServe: the Living Slip on the lock screen is exactly this: Placed, Cooking, On the way, Delivered, ended at Delivered. Android has the matching Live Updates (story D.2).

## Widgets

Source: [Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets). Tier A. Confidence 0.85 (we may not build one soon).

- Simple, timely, tied to the app's main purpose. Do not copy the app icon.
- Widgets refresh from time to time but "don't support continuous, real-time updates". Let the system draw dates and times.
- Standard margin is 16 pt. Text 11 pt or larger. Do not turn text into a picture (VoiceOver cannot read it).
- Colour must not carry meaning alone. Tinted modes desaturate full-colour pictures.
- A tap goes to the matching place in the app.

For GoServe: a widget is later (after the apps). The Live Activity covers the order in flight.

## Accessibility

Source: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Tier A. Confidence 0.9.

- Text can grow "by at least 200 percent". Meet colour contrast minimums; offer higher contrast when Increase Contrast is on; check light and dark.
- "Convey information with more than color alone": shape or icon too.
- Describe every control for VoiceOver.
- Controls must be big enough; about 12 pt of space around round or bordered controls. Buttons (Apple's button page) come in sizes Mini 28, Small 32, Regular 44, Large 52 and Extra large 64 pt; 44 pt is the regular size.
- Simple gestures; always an on-screen alternative to a gesture.
- Avoid timers that auto-dismiss; avoid flashing and fast blinking; support Reduce Motion.

For GoServe: this matches the Ink rules already in the PWA (big tap size, contrast check in both themes). Every Living Slip state also needs words and an icon, not only a colour.

## What this changes for the next stories

- D.5 principles: hierarchy first, one slip, progressive disclosure, motion rare and optional, haptics few and consistent, accessibility from the start.
- D.6 tokens: a size ladder with the 11 pt minimum, no light weights, a 44 pt regular control size.
- Living Slip: end at Delivered, at most two seconds of animation, fit a small circle in compact form.
- Open question for the owner's design yes (D.10): whether the new look uses Apple's Liquid Glass material on iOS or our own flat Ink style on both platforms.

Next to read: Material 3 and Android Live Updates (story #328).
