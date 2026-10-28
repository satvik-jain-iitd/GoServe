// Story #653 (row T3): every text-on-background pair the app draws reaches WCAG AA in Day and in Night: 4.5:1, or 3:1 for large stamp text.
// The ratio is computed from app/src/styles/tokens.css. A pair under its limit fails with its name, the theme and the ratio.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../src/styles/tokens.css"), "utf8");
const appCss = readFileSync(resolve(__dirname, "../../src/styles/app.css"), "utf8");
const decls = (text: string) => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
// The rules of tokens.css in file order; a rule applies to a theme when one of its selectors matches (:root and [data-theme] match both).
const rules = [...css.matchAll(/(^|\n)([^{}\n/][^{}]*)\{([^}]*)\}/g)].map((m) => ({ selectors: m[2].split(",").map((x) => x.trim()), body: m[3] }));
const themeVars = (theme: "day" | "night") => Object.assign({}, ...rules.filter((r) => r.selectors.some((x) => x === ":root" || x === "[data-theme]" || x === `[data-theme="${theme}"]`)).map((r) => decls(r.body)));

function colour(vars: Record<string, string>, token: string, depth = 0): string {
  const v = vars[token];
  if (v === undefined || depth > 8) throw new Error(`token ${token} is not defined`);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return colour(vars, ref[1], depth + 1);
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`token ${token} is not a plain colour: ${v}`);
  return v.toLowerCase();
}
const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// [name, background token, text token, minimum ratio]
const AA = 4.5, LARGE = 3;
const PAIRS: [string, string, string, number][] = [
  ["page text", "--md-background", "--md-on-background", AA],
  ["surface text", "--md-surface", "--md-on-surface", AA],
  ["muted text on the page", "--md-background", "--gs-text-muted", AA],
  ["muted text on a surface", "--md-surface", "--gs-text-muted", AA],
  ["notice (signed-in line, rider card, Sign out)", "--md-tertiary-container", "--md-on-tertiary-container", AA],
  ["badge", "--md-secondary-container", "--md-on-secondary-container", AA],
  ["badge ready", "--gs-status-ready", "--md-on-secondary-container", AA],
  ["badge fail", "--md-error", "--md-on-error", AA],
  ["filled button", "--md-primary", "--md-on-primary", AA],
  ["ghost button", "--md-background", "--md-primary", AA],
  ["chip off", "--md-background", "--md-on-background", AA],
  ["chip on", "--md-primary", "--md-on-primary", AA],
  ["error box", "--md-error", "--md-on-error", AA],
  ["offline line", "--md-surface-variant", "--md-on-surface", AA],
  ["Sent card title", "--md-surface", "--md-primary", AA],
  ["Sent card text", "--md-surface", "--md-on-surface", AA],
  ["tab bar", "--md-surface", "--gs-text-muted", AA],
  ["tab bar, current tab", "--md-surface", "--md-primary", AA],
  ["hero tag", "--gs-status-cooking", "--md-on-tertiary", AA],
  ["tag ready", "--gs-status-ready", "--md-on-tertiary", AA],
  ["tag delivered", "--gs-status-delivered", "--gs-on-action", AA],
  ["tag placed", "--md-background", "--gs-text-muted", AA],
  ["pill half, chosen", "--gs-raised", "--md-on-surface", AA],
  ["stamp placed", "--md-background", "--gs-status-placed", LARGE],
    ["stamp accepted", "--md-background", "--gs-status-accepted", LARGE],
  ["stamp cooking", "--gs-status-cooking", "--md-on-tertiary", LARGE],
  ["stamp ready", "--gs-status-ready", "--md-on-tertiary", LARGE],
  ["stamp delivered", "--md-background", "--gs-status-delivered", LARGE],
  ["stamp error", "--md-background", "--md-error", LARGE],
];

describe("text on background reaches WCAG AA in Day and Night", () => {
  for (const theme of ["day", "night"] as const) {
    const vars = themeVars(theme);
    for (const [name, bg, fg, min] of PAIRS) {
      it(`${theme}: ${name}`, () => {
        const r = ratio(colour(vars, bg), colour(vars, fg));
        expect(r, `${name} (${theme}) is ${r.toFixed(2)}:1, needs ${min}:1`).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe("the CSS uses the pairs the test checks", () => {
  it(".notice and .badge take their text from the on-container tokens", () => {
    expect(appCss).toMatch(/\.notice \{[^}]*color: var\(--md-on-tertiary-container\)/);
    expect(appCss).toMatch(/\.badge \{[^}]*color: var\(--md-on-secondary-container\)/);
  });
});
