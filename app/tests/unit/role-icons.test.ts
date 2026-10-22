// The four role apps have four icons in one family (22 Oct 2026): each role manifest points to its own icon files, and the files exist.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleManifest } from "../../src/pwa-manifest";
import { ROLE_APPS } from "../../src/lib/roles";

const pub = (src: string) => resolve(__dirname, "../../public", src.replace(/^\//, ""));

describe("role icons", () => {
  it("each role manifest carries its own 192, 512 and maskable icons, all on disk", () => {
    for (const role of ROLE_APPS) {
      const icons = roleManifest(role).icons;
      expect(icons.map((i) => i.src), role).toEqual([`/icons/${role}-192.png`, `/icons/${role}-512.png`, `/icons/${role}-maskable-512.png`]);
      expect(icons.map((i) => i.purpose ?? "any"), role).toEqual(["any", "any", "maskable"]);
      for (const i of icons) expect(existsSync(pub(i.src)), i.src).toBe(true);
    }
  });

  it("no two roles share an icon file, and none uses the plain brand icon", () => {
    const all = ROLE_APPS.flatMap((r) => roleManifest(r).icons.map((i) => i.src));
    expect(new Set(all).size).toBe(all.length);
    expect(all.some((s) => /\/icon-/.test(s))).toBe(false);
  });

  it("the icon sources use token colours only (never a new colour)", () => {
    const tokens = JSON.parse(readFileSync(resolve(__dirname, "../../../design/tokens.json"), "utf8")).color;
    const allowed = new Set([...Object.values(tokens.core), ...Object.values(tokens.supporting), tokens.paper].map((h) => (h as string).toUpperCase()));
    for (const role of ROLE_APPS) {
      const svg = readFileSync(resolve(__dirname, `../../../design/brand/icons/${role}.svg`), "utf8");
      for (const hex of svg.match(/#[0-9A-Fa-f]{6}/g) ?? []) expect(allowed.has(hex.toUpperCase()), `${role}: ${hex}`).toBe(true);
    }
  });
});
