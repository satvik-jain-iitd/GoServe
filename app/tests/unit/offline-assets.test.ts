// Story #1107 (TC 1.14): the logo and the welcome picture must be in the service worker's precache, and a failed logo can never take a big box.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("offline brand files", () => {
  it("the PWA precache lists brand/* (the lockup, the pin mark, the welcome thali)", () => {
    const cfg = readFileSync("vite.config.ts", "utf8");
    expect(cfg).toMatch(/includeAssets:\s*\[[^\]]*"brand\/\*"/);
  });
  it("every logo image has a fixed shape (aspect ratio) so a failed load cannot make a huge box", () => {
    const css = readFileSync("src/ui/ui.css", "utf8");
    expect(css).toMatch(/\.ui-lockup\s*\{[^}]*aspect-ratio:\s*7\s*\/\s*1/);
  });
});
