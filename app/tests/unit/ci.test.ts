// Story #895: a hung check must fail on its own, and the browsers come from the image that matches the lock file, not from apt on the runner.
// The text of ci.yml is the proof, as in deploy-env.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
const jobs = Object.fromEntries([...text.split(/^jobs:\n/m)[1].matchAll(/^  ([a-z]+):\n((?:(?:    .*|)\n?)*)/gm)].map((m) => [m[1], m[2]]));
const lockVersion = (dir: string): string => JSON.parse(readFileSync(new URL(`../../../${dir}/package-lock.json`, import.meta.url), "utf8")).packages["node_modules/@playwright/test"].version;

describe("ci.yml (story #895)", () => {
  it("has the board-match job (story 1168), the regression job (story 1178) and the browser shards (story 1641)", () => expect(Object.keys(jobs).sort()).toEqual(["app", "boards", "browser", "gate", "guard", "regression", "site"]));
  it("the browser e2e tests run in four parallel shards, and the App job keeps only the unit and screen checks (story 1641)", () => {
    expect(jobs.browser).toMatch(/^ {6}fail-fast: false$/m);
    expect(jobs.browser).toMatch(/^ {8}shard: \[1, 2, 3, 4\]$/m);
    expect(jobs.browser).toContain("--shard=${{ matrix.shard }}/${{ strategy.job-total }}");
    expect(jobs.browser).toContain("image: mcr.microsoft.com/playwright:v1.64.0-noble");
    expect(jobs.app).toContain("image: mcr.microsoft.com/playwright:v1.64.0-noble");
    expect(jobs.app).not.toContain("test:e2e");
    expect(jobs.app).toContain("screens.sh --check");
  });
  it("the gate waits for the browser shards and reads their result (story 1641)", () => {
    expect(jobs.gate).toMatch(/needs: \[site, app, browser, guard\]/);
    expect(jobs.gate).toContain("needs.browser.result");
    expect(jobs.gate).toContain("successsuccesssuccesssuccess");
  });
  it("the regression job is report only: failures are a warning, and the gate does not wait for it (story #1178)", () => {
    expect(jobs.regression).toMatch(/npm run test:regression \|\| echo "::warning::/);
    expect(jobs.gate).not.toMatch(/regression/);
  });
  it("the board-match job is report only: mismatches are a warning, the check stays green, and the gate does not wait for it (story #1168)", () => {
    expect(jobs.boards).toMatch(/npm run test:boards \|\| echo "::warning::/);
    expect(jobs.gate).not.toMatch(/boards/);
  });
  it("every job has a timeout-minutes, so a hung step is cancelled and the check fails", () => {
    for (const [name, body] of Object.entries(jobs)) expect(body, name).toMatch(/^ {4}timeout-minutes: \d+$/m);
  });
  it("uses the agreed limits: Site 15, App 30, Browser 20 (per shard, story 1641), Guard 10", () => {
    expect(jobs.site).toMatch(/timeout-minutes: 15$/m);
    expect(jobs.app).toMatch(/timeout-minutes: 30$/m);   // story 1634: was 20; the App job was cancelled by the old limit (run 44450204797)
    expect(jobs.browser).toMatch(/timeout-minutes: 20$/m);
    expect(jobs.guard).toMatch(/timeout-minutes: 10$/m);
  });
  it("runs Site and App in the Playwright image of the version in their package-lock, and no job installs browsers with apt", () => {
    for (const [name, dir] of [["site", "site"], ["app", "app"]] as const) expect(jobs[name], name).toContain(`image: mcr.microsoft.com/playwright:v${lockVersion(dir)}-noble`);
    expect(text).not.toContain("playwright install");
  });
});
