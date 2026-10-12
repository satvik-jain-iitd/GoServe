import { describe, it, expect } from "vitest";
import {
  validatePreRegister,
  validateInvestor,
  INTEREST_ROLES,
} from "../../src/lib/validate";

describe("validatePreRegister", () => {
  const good = {
    name: "Satvik Jain",
    email: "satvik@example.com",
    phone: "+91 98765 43210",
    city: "Delhi",
    role: "customer",
  };

  it("accepts a complete, valid form", () => {
    expect(validatePreRegister(good).valid).toBe(true);
  });

  it("rejects a short name", () => {
    const r = validatePreRegister({ ...good, name: "S" });
    expect(r.valid).toBe(false);
    expect(r.errors.name).toBeTruthy();
  });

  it("rejects a bad email", () => {
    const r = validatePreRegister({ ...good, email: "not-an-email" });
    expect(r.valid).toBe(false);
    expect(r.errors.email).toBeTruthy();
  });

  it("rejects a missing city", () => {
    const r = validatePreRegister({ ...good, city: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.city).toBeTruthy();
  });

  it("rejects an unknown role", () => {
    const r = validatePreRegister({ ...good, role: "wizard" });
    expect(r.valid).toBe(false);
    expect(r.errors.role).toBeTruthy();
  });

  it("allows an empty phone", () => {
    const r = validatePreRegister({ ...good, phone: "" });
    expect(r.valid).toBe(true);
  });

  it("rejects a malformed phone when provided", () => {
    const r = validatePreRegister({ ...good, phone: "abc" });
    expect(r.valid).toBe(false);
    expect(r.errors.phone).toBeTruthy();
  });

  it("accepts every known role", () => {
    for (const role of INTEREST_ROLES) {
      expect(validatePreRegister({ ...good, role }).valid).toBe(true);
    }
  });
});

describe("validateInvestor", () => {
  const good = {
    name: "Anita Rao",
    firm: "FoF Ventures",
    email: "anita@fof.vc",
    message: "We would love to learn more about GoServe and the current round.",
  };

  it("accepts a complete, valid message", () => {
    expect(validateInvestor(good).valid).toBe(true);
  });

  it("requires a firm", () => {
    expect(validateInvestor({ ...good, firm: "" }).valid).toBe(false);
  });

  it("requires a message of real length", () => {
    expect(validateInvestor({ ...good, message: "hi" }).valid).toBe(false);
  });

  it("requires a valid email", () => {
    expect(validateInvestor({ ...good, email: "x@y" }).valid).toBe(false);
  });
});
