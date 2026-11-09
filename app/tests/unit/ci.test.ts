// Story #895: a hung check must fail on its own, and the browsers come from the image that matches the lock file, not from apt on the runner.
// The text of ci.yml is the proof, as in deploy-env.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
const jobs = Object.fromEntries([...text.split(/^jobs:\n/m)[1].matchAll(/^  ([a-z]+):\n((?:(?:    .*|)\n?)*)/gm)].map((m) => [m[1], m[2]]));
const lockVersion = (dir: string): string => JSON.parse(readFileSync(new URL(`../../../${dir}/package-lock.json`, import.meta.url), "utf8")).packages["node_modules/@playwright/test"].version;

describe("ci.yml (story #895)", () => {
  it("has the five jobs and the board-match job (story #1168)", () => expect(Object.keys(jobs).sort()).toEqual(["app", "boards", "gate", "guard", "site"]));
  it("the board-match job is report only: mismatches are a warning, the check stays green, and the gate does not wait for it (story #1168)", () => {
    expect(jobs.boards).toMatch(/npm run test:boards \|\| echo "::warning::/);
    expect(jobs.gate).not.toMatch(/boards/);
  });
  it("every job has a timeout-minutes, so a hung step is cancelled and the check fails", () => {
    for (const [name, body] of Object.entries(jobs)) expect(body, name).toMatch(/^ {4}timeout-minutes: \d+$/m);
  });
  it("uses the agreed limits: Site 15, App 20, Guard 10", () => {
    expect(jobs.site).toMatch(/timeout-minutes: 15$/m);
    expect(jobs.app).toMatch(/timeout-minutes: 20$/m);
    expect(jobs.guard).toMatch(/timeout-minutes: 10$/m);
  });
  it("runs Site and App in the Playwright image of the version in their package-lock, and no job installs browsers with apt", () => {
    for (const [name, dir] of [["site", "site"], ["app", "app"]] as const) expect(jobs[name], name).toContain(`image: mcr.microsoft.com/playwright:v${lockVersion(dir)}-noble`);
    expect(text).not.toContain("playwright install");
  });
});
