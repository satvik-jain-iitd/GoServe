// Story #39, scenario S2: app styles match design/tokens.json (the one source of truth).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));
const css = readFileSync(resolve(root, "app/src/styles/tokens.css"), "utf8").toUpperCase();
const up = (h: string) => h.toUpperCase();

describe("app design tokens", () => {
  it("tokens.css defines every core and supporting colour from tokens.json", () => {
    for (const hex of [...Object.values(tokens.color.core), ...Object.values(tokens.color.supporting)]) {
      expect(css).toContain(up(hex as string));
    }
  });

  it("tokens.css defines every order status colour", () => {
    for (const hex of Object.values(tokens.color.status)) expect(css).toContain(up(hex as string));
  });

  it("tokens.css has no colour that is not in tokens.json", () => {
    const allowed = new Set<string>(
      [...Object.values(tokens.color.core), ...Object.values(tokens.color.supporting), ...Object.values(tokens.color.status),
       tokens.color.paper, tokens.color.error, tokens.color.textMuted].map((h) => up(h as string)),
    );
    for (const hex of css.match(/#[0-9A-F]{3,8}\b/g) ?? []) expect(allowed.has(hex), hex).toBe(true);
  });
});
