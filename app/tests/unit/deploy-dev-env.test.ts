// Story #797: dev must turn on the same features prod has on, so checking something on dev
// means something real. The text of the deploy workflow is the proof (same pattern prod's own
// deploy-app.yml check uses).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(new URL("../../../.github/workflows/deploy-dev.yml", import.meta.url), "utf8");

describe("deploy-dev.yml (the dev app)", () => {
  it("turns the phone code on with the fixed sender, same as prod", () => {
    expect(text).toMatch(/VITE_OTP_GATE:\s*["']?1/);
    expect(text).toMatch(/VITE_OTP_SMS:\s*["']?(fixed|real)\b/);
  });
  // Story #900: removing a kitchen is the admin's job now; no build carries the kitchen-app flag (the dev flag of #898 is gone).
  it("no longer carries the Remove this kitchen flag", () => {
    expect(text).not.toContain("VITE_KITCHEN_REMOVE");
  });
  it("carries the sim webhook, same as prod", () => {
    expect(text).toMatch(/VITE_SIM_URL:/);
    expect(text).not.toMatch(/SIM_TOKEN/);   // story 941: no shared simulator token ships in any build
  });
  it("carries the decision engine URL, same as prod", () => {
    expect(text).toMatch(/VITE_ENGINE_URL:/);
  });
  // Story 844: the simulator and the engine webhooks choose a DATABASE (n8n has gs-sim and gs-sim-prod, gs-engine and gs-engine-prod). The dev app once
  // reused prod's secrets "because the endpoint is shared", and the dev admin's Seed, Reset and Tick went to production. A prod secret never builds dev.
  it("references no PROD_ secret at all", () => {
    expect(text).not.toMatch(/secrets\.PROD_/);
  });
  it("builds the sim and engine webhooks from the dev secrets", () => {
    expect(text).toMatch(/VITE_SIM_URL:\s*\$\{\{\s*secrets\.DEV_VITE_SIM_URL\s*\}\}/);
    expect(text).toMatch(/VITE_ENGINE_URL:\s*\$\{\{\s*secrets\.DEV_VITE_ENGINE_URL\s*\}\}/);
  });
  it("refuses to build when a dev webhook secret is missing, instead of falling back to prod", () => {
    expect(text).toMatch(/DEV_VITE_SIM_URL[\s\S]*are not set/);
    expect(text).toMatch(/exit 1/);
  });
  it("refuses a dev webhook address that names a prod copy, even if someone pasted it into the dev secret", () => {
    expect(text).toMatch(/\*-prod\*/);
  });
  it("draws Clear everything in a dev build only (story 848)", () => {
    expect(text).toMatch(/VITE_SIM_CLEAR:\s*"1"/);
  });
  // The pre-prod branch was renamed from staging to dev (owner, 30 Oct 2026). A trigger left on the
  // old name deploys nothing and says nothing, so the branch name is checked here.
  it("deploys from the dev branch", () => {
    expect(text).toMatch(/branches:\s*\[dev\]/);
  });
});
