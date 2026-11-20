// Story #1369: the screen spec runs once, through `scripts/screens.sh --check`. The App job's e2e step leaves it out by file name,
// so a screen test is never run twice. The ShipQuick check (check_screens_wired.py) reads the workflow text for the --check call.
// The step must also be able to find the script: the App job's default working directory is app/, the script is at the repo root.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
const app = ci.slice(ci.indexOf("  app:"), ci.indexOf("\n  boards:") > 0 ? ci.indexOf("\n  boards:") : undefined);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// The text of one step: from its "- name:" line to the next step.
const step = (name: string) => {
  const start = app.indexOf(`- name: ${name}`);
  if (start < 0) return "";
  const next = app.indexOf("\n      - ", start + 1);
  return app.slice(start, next > 0 ? next : undefined);
};

// Story 1641: the browser e2e tests are a job of their own (shards), after regression; the App job keeps the screen check.
const browser = ci.slice(ci.indexOf("  browser:"), ci.indexOf("\n  guard:") > 0 ? ci.indexOf("\n  guard:") : undefined);

describe("ci.yml, App job: the screen spec runs once", () => {
  it("the browser shards leave screens.spec.ts out by file name", () => {
    expect(browser).toMatch(/npm run test:e2e -- --grep-invert 'screens\\\.spec\\\.ts'/);
  });
  it("the App job has no e2e line, and one step runs scripts/screens.sh --check", () => {
    expect(app).not.toContain("npm run test:e2e");
    expect(app).toContain("bash scripts/screens.sh --check");
  });
  it("that step runs from the repo root, where scripts/screens.sh is (the App job defaults to app/)", () => {
    const s = step("Screens (the render gate, once)");
    expect(s, "the screens step is missing").not.toBe("");
    const dir = s.includes("working-directory: ${{ github.workspace }}") ? repo : join(repo, "app");
    expect(existsSync(join(dir, "scripts/screens.sh")), `scripts/screens.sh is not under ${dir}`).toBe(true);
  });
});
