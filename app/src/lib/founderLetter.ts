// Stories 1129 and 1563: the words of the co-founder's letter, kept in one place. The screen (NoKitchen.tsx) and the shared text are both made from this list,
// so they cannot drift apart. The promise is written only when the stored row holds it (offerPaise), so the words are always true.
export const SITE = "https://letsdwelo.in/";
export const KICKER = "A letter from co-founder Satvik Jain";
export const TITLE = ["You found us early.", "Thank you."];
export const RULE = "At GoServe we have one rule.";
export const MOTTO = ["Pahle banda, phir dhanda.", "People first, business after."];
export const SIGN = "Satvik";

/** The paragraphs before the rule. `off` is the bold part of the promise ("₹100 off"), or null when there is no promise. */
export function letterParas(place: string, offerPaise: number | null) {
  const off = offerPaise ? `₹${Math.round(offerPaise / 100)} off` : null;
  return { off, paras: [
    `We don't reach ${place} yet. I am sorry you came all this way for nothing today.`,
    "We are a small, new kitchen, and we are growing fast. You trusted us first. That means a lot to me.",
    ...(off ? [`So here is my promise: the day we open in ${place}, your first order is ${off}. We will message you.`] : []),
  ] };
}

/** The letter as text for a share sheet: one blank line between paragraphs, the site's address last. WhatsApp bold (stars, never next to a space) on the title and the motto's first line only. */
export function letterText(place: string, offerPaise: number | null) {
  return [KICKER, `*${TITLE.join(" ")}*`, ...letterParas(place, offerPaise).paras, RULE, `*${MOTTO[0]}*\n${MOTTO[1]}`, SIGN, SITE].join("\n\n");
}
