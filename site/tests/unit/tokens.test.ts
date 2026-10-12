// Story #18, scenario S2: design/tokens.json is the one source of truth for colours.
// palette.ts, tokens.css and the diagram theme must match it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CORE, SUPPORTING, STATUS } from "../../src/data/palette";

const root = resolve(__dirname, "../../..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));
const css = readFileSync(resolve(root, "site/src/styles/tokens.css"), "utf8").toUpperCase();
const theme = JSON.parse(readFileSync(resolve(root, "docs/architecture/diagrams/theme.json"), "utf8"));
const up = (h: string) => h.toUpperCase();
const all = new Set<string>(
  [...Object.values(tokens.color.core), ...Object.values(tokens.color.supporting), ...Object.values(tokens.color.status),
   tokens.color.paper, tokens.color.error].map((h) => up(h as string)),
);

describe("design tokens: one source of truth", () => {
  it("palette.ts core, supporting and status colours match tokens.json", () => {
    const fromJson = (group: Record<string, string>) => Object.values(group).map(up).sort();
    expect(CORE.map((s) => up(s.hex)).sort()).toEqual(fromJson(tokens.color.core));
    expect(SUPPORTING.map((s) => up(s.hex)).sort()).toEqual(fromJson(tokens.color.supporting));
    expect(STATUS.map((s) => up(s.hex)).sort()).toEqual(fromJson(tokens.color.status));
  });

  it("tokens.css defines every core and supporting colour", () => {
    for (const hex of [...Object.values(tokens.color.core), ...Object.values(tokens.color.supporting)]) {
      expect(css).toContain(up(hex as string));
    }
  });

  it("the diagram theme allows only token colours", () => {
    for (const hex of theme.allowed) expect(all.has(up(hex))).toBe(true);
  });
});
