// Story #1044 (owner, 8 Nov 2026, screen audit): a control carries its label only; a line under it only for live state or an error with its way out. These texts were cut or shortened.
// This guard fails if any of them is back in app/src, if text goes uppercase by style, or if a phone number is split in two.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { showPhone } from "../../src/lib/otp";

const SRC = resolve(__dirname, "../../src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(n) ? [p] : []; });
const text = files(SRC).map((f) => [f, readFileSync(f, "utf8")] as const);
const hits = (needle: string | RegExp) => text.filter(([, t]) => (typeof needle === "string" ? t.includes(needle) : needle.test(t))).map(([f]) => f.replace(SRC, "src"));

const GONE = [
  "Hot meals from our kitchen · cash at the door", "No app to install", "Signed in with Google. Your orders stay on every phone.", "Keeps your orders on every phone.",
  "Off for this phone. Tap to turn on.", "Tap to turn on", "Sign out brings the Google sign-in back", "Address · food gets delivered here", "Address · the rider reads this",
  "Phone · the rider calls this", "Phone · the admin calls this", "Pin codes · comma between them", "Anything the kitchen should know? · optional", "The cook reads these exact words",
  "Edit details · the location pin has its own map", "No password, no code to wait for.", "Only riders the admin has added can sign in. No password, no form.",
  "Only the admin accounts on the list can sign in. No password, no form.", "Only the staff the admin has added can sign in. No password, no form.",
  "Your mobile number, then a 6 digit code. The rider calls this number.", "We ask for your mobile number on the bill, so the rider can call you.",
  "Allow location and we fill in your address. You can fix it before the menu opens.", "We found this from your location. Fix anything, then go on.",
  "Type your address and pin code. The rider reads this.", "Add your name, phone and address to place the order.", "Swipe down to leave it waiting",
  "Your internet is fine. The kitchen has nothing listed yet.", "New orders ring and show here. Keep this page open.", "The nearest ready order comes to this screen. Keep the page open.",
  "Go online to get deliveries. While online, this phone shares your location", "Tap a dish to change it, mark it sold out, or delete it.", "Off = Sold out on the menu, the dish stays",
  "Delete asks once more, the danger sheet way.", "A kitchen with no pin code never shows to a customer.", "A pin code taken away hides the kitchen from those customers at once.",
  "Investor demos only. Real riders: add in City.", "After it, Seed the kitchens brings the city back.", "The red button wakes up when the word matches.",
  "Open orders? It refuses until they are done.", "Ask 1 of 2 · asks twice · admin only",
];

describe("story #1044: the removed texts stay removed", () => {
  for (const t of GONE) it(`"${t.slice(0, 60)}" is not in app/src`, () => expect(hits(t), t).toEqual([]));

  it("no text is made uppercase by style (sentence case everywhere)", () => {
    expect(hits(/text-transform:\s*uppercase/i)).toEqual([]);
    expect(hits(/textTransform:\s*["']uppercase["']/)).toEqual([]);
  });

  it("every pin code placeholder is 123456 (owner, 8 Nov 2026), never 000000", () => {
    expect(hits(/placeholder=["{][^>]*000000/)).toEqual([]);
    expect(hits('placeholder="123456, 123457"')).toEqual(["src/screens/AdminCity.tsx"]);
  });

  it("a phone number shows as 10 digits together, with the country code in front", () => {
    expect(showPhone("9876543210")).toBe("+91 9876543210");
  });

  it("the onboarding tagline is the one sentence, in the header", () => {
    expect(hits("Hot meals from our kitchen for you in 20 mins").sort()).toEqual(["src/screens/AreaScreen.tsx", "src/screens/OtpSheet.tsx"]);
  });
});
