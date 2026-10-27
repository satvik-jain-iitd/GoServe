// Story #485: one way to do a thing, never two (owner, 27 Oct). Order again is gone; a past order's slip has one button, "See the menu".
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk(resolve(__dirname, "../../src")).filter((f) => /\.(ts|tsx)$/.test(f));

describe("one way to order", () => {
  it("no Order again text, no orderAgain code, no reorder button anywhere in the app source", () => {
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/order again|orderAgain|reorder/i);
  });
  it("the placed screen's bottom button for a delivered or cancelled order reads See the menu", () => {
    expect(readFileSync(resolve(__dirname, "../../src/screens/PlacedScreen.tsx"), "utf8")).toMatch(/>See the menu</);
  });
});
