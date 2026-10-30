// Story #551: the gate and the small helpers of the phone code. The sheets are tested in tests/e2e/otp.spec.ts.
import { describe, expect, it } from "vitest";
import { otpGateOn, placeholderLeft } from "../../src/lib/otpGate";
import { isMobile, readAnswer, showPhone, toPhone } from "../../src/lib/otp";

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
    expect(placeholderLeft({ VITE_OTP_GATE: "1", VITE_OTP_SMS: "fixed" })).toBe(true);   // story #665: the fixed code is still a placeholder, the warning stays
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

// Story #802: the server tells the sheet which code store this number belongs to, before any code is spent.
describe("the server's answer, as the sheet reads it (story #802)", () => {
  it("a number that already has an account asks for sign-in", () => {
    expect(readAnswer(true, { ok: true, sign_in: true })).toEqual({ ok: true, signIn: true });
  });
  it("a plain yes stays a plain yes", () => {
    expect(readAnswer(true, { ok: true, expires_in_s: 600 })).toEqual({ ok: true });
    expect(readAnswer(true, { ok: true, phone: "919876543210" })).toEqual({ ok: true, phone: "919876543210" });
  });
  it("a refusal keeps the server's own words", () => {
    expect(readAnswer(false, { ok: false, error: "wrong_code", message: "That code is not right." }))
      .toEqual({ ok: false, error: "wrong_code", message: "That code is not right." });
  });
  it("a refusal with no words gets our line for that word, or the general one", () => {
    expect(readAnswer(false, { ok: false, error: "otp_unavailable" }))
      .toEqual({ ok: false, error: "otp_unavailable", message: "Codes are down for a moment. Try again in a minute." });
    expect(readAnswer(false, { ok: false, error: "weird" }))
      .toEqual({ ok: false, error: "weird", message: "Something went wrong on our side. Try again in a minute." });
  });
  it("anything outside the contract reads as not reaching us", () => {
    for (const a of [null, {}, { ok: true, sign_in: "yes" }, { nope: 1 }]) {
      const r = readAnswer(false, a);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("network");
    }
  });
  it("sign_in is only believed when it is exactly true", () => {
    expect(readAnswer(true, { ok: true, sign_in: "yes" })).toEqual({ ok: true });
    expect(readAnswer(true, { ok: true, sign_in: 1 })).toEqual({ ok: true });
  });
});
