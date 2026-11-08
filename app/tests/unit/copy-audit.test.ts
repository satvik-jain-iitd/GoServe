// Story #1044 (owner, 8 Nov 2026, screen audit): a control carries its label only; a line under it only for live state or an error with its way out. These admin, kitchen and rider texts were cut or shortened.
// This guard fails if any of them is back in app/src. (The customer texts follow in the next layer, which adds them to this list.)
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC = resolve(__dirname, "../../src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(n) ? [p] : []; });
const text = files(SRC).map((f) => [f, readFileSync(f, "utf8")] as const);
const hits = (needle: string) => text.filter(([, t]) => t.includes(needle)).map(([f]) => f.replace(SRC, "src"));

const GONE = [
  "Sign out brings the Google sign-in back", "Address · the rider reads this", "Phone · the admin calls this", "Pin codes · comma between them", "Edit details · the location pin has its own map",
  "Only riders the admin has added can sign in. No password, no form.", "Only the admin accounts on the list can sign in. No password, no form.", "Only the staff the admin has added can sign in. No password, no form.",
  "Go online to get deliveries. While online, this phone shares your location", "New orders ring and show here. Keep this page open.", "The nearest ready order comes to this screen. Keep the page open.",
  "Tap a dish to change it, mark it sold out, or delete it.", "Off = Sold out on the menu, the dish stays", "Delete asks once more, the danger sheet way.",
  "A kitchen with no pin code never shows to a customer.", "A pin code taken away hides the kitchen from those customers at once.", "Investor demos only. Real riders: add in City.",
  "After it, Seed the kitchens brings the city back.", "The red button wakes up when the word matches.", "Open orders? It refuses until they are done.", "Ask 1 of 2 · asks twice · admin only",
  "No app to install · works in the browser",
];

describe("story #1044: the removed admin, kitchen and rider texts stay removed", () => {
  for (const t of GONE) it(`"${t.slice(0, 60)}" is not in app/src`, () => expect(hits(t), t).toEqual([]));
});
