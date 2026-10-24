// Story D1 (#160): the design system. Components in app/src/ui, one look for every screen.
import { describe, it, expect } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppBar, Button, Chip, Empty, Sheet, Skeleton, Stepper, StickyBar, Tile, Timeline } from "../../src/ui";
import { contrast } from "../../src/ui/contrast";
import { styleguideOn } from "../../src/ui/flag";

// Loose typing on purpose: the test is a .ts file, so it builds elements without JSX.
const h = createElement as (...a: unknown[]) => ReactElement;
const root = resolve(__dirname, "../../..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));
const css = readFileSync(resolve(__dirname, "../../src/ui/ui.css"), "utf8");
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("components (one snapshot each)", () => {
  it("S1 AppBar", () => expect(render(h(AppBar, { title: "Menu", onBack: () => {} }))).toMatchSnapshot());
  it("S1 Tile", () => expect(render(h(Tile, { title: "Dal Makhani", meta: "Hauz Khas Kitchen", price: "₹220", image: "/x.png", veg: true }, h(Button, {}, "Add")))).toMatchSnapshot());
  it("S1 Chip", () => expect(render(h(Chip, { selected: true }, "Veg"))).toMatchSnapshot());
  it("S1 Stepper", () => expect(render(h(Stepper, { label: "Dal Makhani", value: 2, onChange: () => {} }))).toMatchSnapshot());
  it("S1 StickyBar", () => expect(render(h(StickyBar, {}, h(Button, {}, "View cart")))).toMatchSnapshot());
  it("S1 Timeline", () => expect(render(h(Timeline, { steps: ["Placed", "Cooking", "Ready"], current: 1 }))).toMatchSnapshot());
  it("S1 Sheet", () => expect(render(h(Sheet, { open: true, title: "Feedback", onClose: () => {} }, "Hello"))).toMatchSnapshot());
  it("S1 Sheet closed renders nothing", () => expect(render(h(Sheet, { open: false, title: "x", onClose: () => {} }, "Hello"))).toBe(""));
  it("S1 Button", () => expect(render(h(Button, { variant: "ghost" }, "Back"))).toMatchSnapshot());
  it("S1 big Button", () => expect(render(h(Button, { size: "big" }, "Accept"))).toMatchSnapshot());
  it("S1 Empty", () => expect(render(h(Empty, { title: "No orders yet", hint: "Pick a dish." }))).toMatchSnapshot());
  it("S1 Skeleton", () => expect(render(h(Skeleton, { lines: 3 }))).toMatchSnapshot());
});

describe("accessibility", () => {
  it("S2 the Timeline marks the current step and the Chip says if it is pressed", () => {
    expect(render(h(Timeline, { steps: ["A", "B"], current: 1 }))).toContain('aria-current="step"');
    expect(render(h(Chip, { selected: true }, "Veg"))).toContain('aria-pressed="true"');
  });
  it("S2 the Sheet is a labelled dialog", () => {
    const html = render(h(Sheet, { open: true, title: "Feedback", onClose: () => {} }, "x"));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Feedback");
  });
  it("S2 the Stepper buttons are named", () => {
    const html = render(h(Stepper, { label: "Dal", value: 1, onChange: () => {} }));
    expect(html).toContain('aria-label="Less Dal"');
    expect(html).toContain('aria-label="More Dal"');
  });
  it("S2 text pairs pass WCAG AA (4.5) from tokens.json", () => {
    const c = tokens.color;
    const pairs: [string, string][] = [
      [c.core.inkGreen, c.core.cream], [c.core.inkGreen, c.core.offWhite], [c.paper, c.core.deepGreen],
      [c.textMuted, c.core.cream], [c.textMuted, c.core.offWhite], [c.paper, c.error], [c.core.inkGreen, c.core.sage],
      [c.core.deepGreen, c.core.offWhite], [c.core.inkGreen, c.core.warmYellow], [c.core.inkGreen, c.core.lime],
    ];
    for (const [fg, bg] of pairs) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe("css rules", () => {
  it("S3 the Ink fonts are loaded by the app (self-hosted, no third party)", () => {
    expect(readFileSync(resolve(__dirname, "../../src/main.tsx"), "utf8")).toContain("./styles/fonts.css");
    expect(readFileSync(resolve(__dirname, "../../src/styles/fonts.css"), "utf8")).toContain("url(/fonts/");
  });
  it("S3 spacing: no rem in padding, margin or gap, and no raw length above 52 px (the screen header's top is 52)", () => {
    for (const m of css.matchAll(/(?:padding|margin|gap)[a-z-]*:\s*([^;]+);/g)) {
      expect(m[1], m[0]).not.toMatch(/\drem\b/);
      for (const n of m[1].matchAll(/(\d+(?:\.\d+)?)px/g)) expect(Number(n[1]), m[0]).toBeLessThanOrEqual(52);
    }
  });
  it("S3 no colour in ui.css that is not a token variable (Day and Night come from tokens.css)", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("S3 no review-only themes in the app sheet (Night Blue and Sunset were mockups)", () => {
    expect(css).not.toContain("night-blue");
    expect(css).not.toContain("sunset");
  });
  it("S3 tap targets are at least 44 px", () => {
    for (const sel of [".ui-btn", ".ui-chip", ".ui-step", ".ui-back"]) {
      const rule = css.match(new RegExp("(?:^|\\n)" + sel.replace(".", "\\.") + " \\{([^}]*)\\}"))?.[1];
      expect(rule, sel).toBeTruthy();
      expect(rule, sel).toMatch(/(min-)?(height|width):\s*var\(--gs-tap\)/);
    }
    expect(readFileSync(resolve(__dirname, "../../src/styles/tokens.css"), "utf8")).toMatch(/--gs-tap:\s*44px/);
  });
  it("S3 the big button is at least 56 px for one-thumb staff screens", () => {
    expect(css).toMatch(/\.ui-btn\.big \{[^}]*min-height:\s*var\(--gs-tap-big\)/);
    expect(readFileSync(resolve(__dirname, "../../src/styles/tokens.css"), "utf8")).toMatch(/--gs-tap-big:\s*56px/);
  });
  it("S3 motion is switched off for people who ask for less", () => {
    expect(css).toContain("prefers-reduced-motion");
  });
});

describe("styleguide flag", () => {
  it("S4 /styleguide shows only when the build flag is on", () => {
    expect(styleguideOn("/styleguide", "1")).toBe(true);
    expect(styleguideOn("/styleguide/", "1")).toBe(true);
    expect(styleguideOn("/styleguide", undefined)).toBe(false);
    expect(styleguideOn("/customer/", "1")).toBe(false);
  });
});
