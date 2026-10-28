// Story #485: one way to do a thing, never two (owner, 27 Oct). A delivered order's slip has one button, "See the menu". Story #660 (owner's mark E.7, 28 Oct): a cancelled order, and only that, offers "Order again".
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk(resolve(__dirname, "../../src")).filter((f) => /\.(ts|tsx)$/.test(f));

describe("one way to order", () => {
  it("no Order again text, no orderAgain code, no reorder button anywhere in the app source", () => {
    for (const f of files.filter((f) => !f.endsWith("PlacedScreen.tsx"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/order again|orderAgain|reorder/i);
    expect(readFileSync(resolve(__dirname, "../../src/screens/PlacedScreen.tsx"), "utf8").match(/order again/gi)).toHaveLength(1);   // the one cancelled-order button
  });
  it("the placed screen's bottom button for a delivered or cancelled order reads See the menu", () => {
    expect(readFileSync(resolve(__dirname, "../../src/screens/PlacedScreen.tsx"), "utf8")).toMatch(/cancelled \? "Order again" : "See the menu"/);
  });
});
