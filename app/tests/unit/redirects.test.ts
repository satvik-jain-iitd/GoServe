// Story H2 (#185) sent `/` to the customer app. Story #503 replaces that: `/` is the static story page with four doors, so nothing redirects it.
// Cloudflare Pages reads this file from the build.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("_redirects", () => {
  const text = readFileSync(resolve(__dirname, "../../public/_redirects"), "utf8");
  const rules = text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  it("S1 the root is not redirected: the story page is served at /", () => {
    expect(rules.map((l) => l.trim().split(/\s+/)[0])).not.toContain("/");
  });
  it("S1 there are no redirect rules at all: the role apps, console, health and legal pages are plain pages", () => {
    expect(rules).toHaveLength(0);
  });
});
