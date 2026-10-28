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
  // Story #665 (owner, 28 Oct): the phone code is on in prod with the fixed code. The gate is allowed only together with `fixed` or `real`, never alone.
  it("sets the phone code gate only together with the fixed or the real sender", () => {
    expect(text).toMatch(/VITE_OTP_GATE:\s*["']?1/);
    expect(text).toMatch(/VITE_OTP_SMS:\s*["']?(fixed|real)\b/);
  });
  it("does not turn the offers on: the order still goes through the v1 path (stories #588, #590)", () => {
    expect(text).not.toContain("VITE_OFFERS");
  });
});
