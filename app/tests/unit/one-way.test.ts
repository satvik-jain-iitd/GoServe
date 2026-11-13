// Story #485: one way to do a thing, never two (owner, 27 Oct). A delivered order's slip has one button, "See the menu". Story #660 (owner's mark E.7, 28 Oct): a cancelled order, and only that, offers "Order again". Story #977 (owner, 8 Nov, board H1): a delivered slip in History offers "Order again" as well, and that is the one reorder path in the code (reorderCart).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk(resolve(__dirname, "../../src")).filter((f) => /\.(ts|tsx)$/.test(f));

describe("one way to order", () => {
  it("no Order again text, no orderAgain code, no reorder button anywhere in the app source", () => {
    const ALLOWED = ["OrdersScreen.tsx", "App.tsx", "cart.ts", "area.ts"];   // story #977: the History button and the one function behind it; story #1162: area.ts holds the sentence "Order again from 6:00 pm." on a closed menu (owner's words, a line, not a button)
    for (const f of files.filter((f) => !ALLOWED.some((a) => f.endsWith(a)))) expect(readFileSync(f, "utf8"), f).not.toMatch(/order again|orderAgain|reorder/i);
    expect(readFileSync(resolve(__dirname, "../../src/screens/OrdersScreen.tsx"), "utf8").match(/>Order again</g)).toHaveLength(1);   // story #977: the one History button
  });
  it("story 1434: the placed screen's main button for a delivered or cancelled order reads Back to menu; the slip has no Order again", () => {
    const placed = readFileSync(resolve(__dirname, "../../src/screens/PlacedScreen.tsx"), "utf8");
    expect(placed).toMatch(/>Back to menu<\/button>/);
    expect(placed).not.toMatch(/order again|See the menu/i);
  });
});
