// Story H2 (#185): on the real site `/` is the customer app, not the demo console. Cloudflare Pages reads this file from the build.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("_redirects", () => {
  const text = readFileSync(resolve(__dirname, "../../public/_redirects"), "utf8");
  it("S1 the root goes to the customer app with a temporary redirect", () => {
    expect(text.split("\n").map((l) => l.trim().split(/\s+/).join(" "))).toContain("/ /customer/ 302");
  });
  it("S1 only the root is redirected: the role apps, health and legal pages are not", () => {
    const rules = text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    expect(rules).toHaveLength(1);
  });
});
