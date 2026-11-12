// Story #1369: the screen spec runs once, through `scripts/screens.sh --check`. The App job's e2e step leaves it out by file name,
// so a screen test is never run twice. The ShipQuick check (check_screens_wired.py) reads the workflow text for the --check call.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
const app = ci.slice(ci.indexOf("  app:"), ci.indexOf("\n  boards:") > 0 ? ci.indexOf("\n  boards:") : undefined);

describe("ci.yml, App job: the screen spec runs once", () => {
  it("the e2e step leaves screens.spec.ts out by file name", () => {
    expect(app).toMatch(/npm run test:e2e -- --grep-invert 'screens\\\.spec\\\.ts'/);
  });
  it("one step runs scripts/screens.sh --check after the e2e step", () => {
    const e2e = app.indexOf("npm run test:e2e");
    const check = app.indexOf("bash scripts/screens.sh --check");
    expect(check).toBeGreaterThan(e2e);
    expect(e2e).toBeGreaterThan(-1);
  });
});
