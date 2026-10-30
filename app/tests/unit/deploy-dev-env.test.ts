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
  it("carries the sim webhook, same as prod", () => {
    expect(text).toMatch(/VITE_SIM_URL:/);
    expect(text).toMatch(/VITE_SIM_TOKEN:/);
  });
  it("carries the decision engine URL, same as prod", () => {
    expect(text).toMatch(/VITE_ENGINE_URL:/);
  });
  // The pre-prod branch was renamed from staging to dev (owner, 30 Oct 2026). A trigger left on the
  // old name deploys nothing and says nothing, so the branch name is checked here.
  it("deploys from the dev branch", () => {
    expect(text).toMatch(/branches:\s*\[dev\]/);
  });
});
