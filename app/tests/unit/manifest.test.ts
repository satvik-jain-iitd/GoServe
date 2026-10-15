// Story #39, scenario S1: the build ships an installable web app manifest.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { manifest } from "../../src/pwa-manifest";

const root = resolve(__dirname, "../../..");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens.json"), "utf8"));
const colours = new Set<string>(
  [...Object.values(tokens.color.core), ...Object.values(tokens.color.supporting)].map((h) => (h as string).toUpperCase()),
);

describe("web app manifest", () => {
  it("is installable: name, standalone display, start url", () => {
    expect(manifest.name).toBe("GoServe");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
  });

  it("has 192 and 512 icons that exist on disk", () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons) expect(existsSync(resolve(__dirname, "../../public", icon.src.replace(/^\//, "")))).toBe(true);
  });

  it("uses token colours only", () => {
    expect(colours.has(manifest.theme_color.toUpperCase())).toBe(true);
    expect(colours.has(manifest.background_color.toUpperCase())).toBe(true);
  });

  it("takes its colours from tokens.json (deep green, cream)", () => {
    expect(manifest.theme_color.toUpperCase()).toBe(tokens.color.core.deepGreen.toUpperCase());
    expect(manifest.background_color.toUpperCase()).toBe(tokens.color.core.cream.toUpperCase());
  });

  it("index.html theme-color matches the manifest and links an Apple touch icon (iPhone install)", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    expect(html).toContain(`<meta name="theme-color" content="${manifest.theme_color}"`);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/icons\/icon-192\.png"/);
  });
});
