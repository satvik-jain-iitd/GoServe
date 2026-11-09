// A real app deploy never carries the test doubles' switches (reviewer, 27 Oct 2026, story #552 and #554). The text of the deploy workflow is the proof.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(new URL("../../../.github/workflows/deploy-app.yml", import.meta.url), "utf8");

describe("deploy-app.yml (the real app)", () => {
  it("does not set the payment test helper or its dev secret", () => {
    expect(text).not.toContain("VITE_PAYMENTS_PLACEHOLDER");
    expect(text).not.toContain("VITE_PAYMENTS_DEV_SECRET");
  });
  it("does not use the dev webhook secret: prod has its own PAYMENTS_WEBHOOK_SECRET or none", () => {
    expect(text).not.toMatch(/PAYMENTS_WEBHOOK_SECRET:\s*dev|dev-secret/);
  });
  it("does not turn the native push seam on by itself", () => {
    expect(text).not.toMatch(/VITE_PUSH_NATIVE:\s*["']?real/);
  });
  // Story #1155 (owner, 9 Nov): the build never turns the phone code gate on (see no-otp-gate.test.ts); the sender stays `fixed` or `real`.
  it("keeps the phone code sender fixed or real", () => {
    expect(text).toMatch(/VITE_OTP_SMS:\s*["']?(fixed|real)\b/);
  });
  // Story 844: the same wall from the other side. The real app is built from prod secrets only.
  it("references no DEV_ secret at all", () => {
    expect(text).not.toMatch(/secrets\.DEV_/);
  });
  it("does not turn the offers on: the order still goes through the v1 path (stories #588, #590)", () => {
    expect(text).not.toContain("VITE_OFFERS");
  });
  it("never turns Clear everything on in the real app (story 848)", () => {
    expect(text).not.toContain("VITE_SIM_CLEAR");
  });
  it("never turns the Remove this kitchen row on in the real app (story 850)", () => {
    expect(text).not.toContain("VITE_KITCHEN_REMOVE");
  });
});
