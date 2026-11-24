// #944: the demo console page is a test-build page. A release build (no VITE_STYLEGUIDE) must not emit /console/; health and styleguide stay.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const build = (flag: string | undefined) => {
  const out = mkdtempSync(join(tmpdir(), "gs-build-"));
  const env = { ...process.env, VITE_STYLEGUIDE: flag };
  if (flag === undefined) delete env.VITE_STYLEGUIDE;
  execFileSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], { env, stdio: "ignore" });
  return out;
};

describe("console page in the build", () => {
  it("is not emitted in a release build, health and styleguide are", () => {
    const out = build(undefined);
    try {
      expect(existsSync(join(out, "console", "index.html"))).toBe(false);
      expect(existsSync(join(out, "health", "index.html"))).toBe(true);
      expect(existsSync(join(out, "styleguide", "index.html"))).toBe(true);
    } finally { rmSync(out, { recursive: true, force: true }); }
  }, 180_000);

  it("is emitted in the test build (VITE_STYLEGUIDE=1)", () => {
    const out = build("1");
    try { expect(existsSync(join(out, "console", "index.html"))).toBe(true); } finally { rmSync(out, { recursive: true, force: true }); }
  }, 180_000);
});
