// Story #551: the gate and the small helpers of the phone code. The sheets are tested in tests/e2e/otp.spec.ts.
import { describe, expect, it } from "vitest";
import { otpGateOn, placeholderLeft } from "../../src/lib/otpGate";
import { isMobile, showPhone, toPhone } from "../../src/lib/otp";

const store = (v: string | null) => ({ getItem: () => v });

describe("the phone code gate", () => {
  it("is off by default", () => {
    expect(otpGateOn({}, store(null))).toBe(false);
    expect(otpGateOn({}, undefined)).toBe(false);
  });
  it("is on by the env var or by this phone's own switch", () => {
    expect(otpGateOn({ VITE_OTP_GATE: "1" }, store(null))).toBe(true);
    expect(otpGateOn({}, store("1"))).toBe(true);
    expect(otpGateOn({}, store("0"))).toBe(false);
  });
  it("is off when the storage is blocked", () => {
    expect(otpGateOn({}, { getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });
  it("seam: a gate that is on while the SMS sender is still the placeholder is wrong", () => {
    expect(placeholderLeft({ VITE_OTP_GATE: "1" })).toBe(true);
    expect(placeholderLeft({ VITE_OTP_GATE: "1", VITE_OTP_SMS: "fake" })).toBe(true);
    expect(placeholderLeft({ VITE_OTP_GATE: "1", VITE_OTP_SMS: "real" })).toBe(false);
    expect(placeholderLeft({})).toBe(false);
  });
  it("seam: the env this run was started with must not hold the placeholder with the gate on", () => {
    expect(placeholderLeft(import.meta.env), "VITE_OTP_GATE=1 needs VITE_OTP_SMS=real: swap the sender (owner click) first").toBe(false);
  });
});

describe("number helpers", () => {
  it("accepts an Indian mobile number and nothing else", () => {
    expect(isMobile("9876543210")).toBe(true);
    expect(["1234567890", "98765", "98765432101", "98765abcde"].some(isMobile)).toBe(false);
  });
  it("shows and sends the number with +91", () => {
    expect(showPhone("9876543210")).toBe("+91 98765 43210");
    expect(toPhone("9876543210")).toBe("+919876543210");
  });
});
