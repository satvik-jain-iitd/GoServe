// Story #39 S2, rewritten for Ink v3 (story H10, #193): app/src/styles/tokens.css carries exactly the colours of design/tokens.json "ink", in Day and in Night.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));
const css = readFileSync(resolve(root, "app/src/styles/tokens.css"), "utf8");
const block = (re: RegExp) => css.match(re)![1];
const vars = (b: string) => Object.fromEntries([...b.matchAll(/--gs-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toLowerCase()]));
const day = vars(block(/:root, \[data-theme="day"\] \{([^}]*)\}/));
const night = vars(block(/\[data-theme="night"\] \{([^}]*)\}/));
const lower = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.toLowerCase()]));

describe("app design tokens (Ink v3)", () => {
  it("the Day colours in tokens.css are the Day colours in tokens.json", () => {
    expect(day).toEqual(lower(tokens.ink.day));
  });
  it("the Night colours in tokens.css are the Night colours in tokens.json", () => {
    expect(night).toEqual(lower(tokens.ink.night));
  });
  it("Night changes only paper and ink: every Night name is also a Day name", () => {
    for (const k of Object.keys(night)) expect(k in day, k).toBe(true);
  });
  it("the original brand colours are still the Day colours (cream, deep green, ink green, sage, lime, yellow)", () => {
    for (const [k, hex] of Object.entries({ cream: tokens.color.core.cream, "deep-green": tokens.color.core.deepGreen, "ink-green": tokens.color.core.inkGreen, sage: tokens.color.core.sage, lime: tokens.color.core.lime, "warm-yellow": tokens.color.core.warmYellow })) {
      expect(day[k], k).toBe((hex as string).toLowerCase());
    }
  });
  it("the three fonts are named: Bricolage Grotesque, Anek Latin, DM Mono", () => {
    expect(css).toContain("Bricolage Grotesque");
    expect(css).toContain("Anek Latin");
    expect(css).toContain("DM Mono");
  });
});
