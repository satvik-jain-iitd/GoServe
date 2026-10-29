// Story #187 (H4): the app mirrors the database's field rules (docs/product/validation-rules.md, migration 0048). One test per rule.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPhone } from "../../src/lib/profile";
import { isMobile } from "../../src/lib/otp";
import { isPin } from "../../src/lib/area";
import { MAX_QTY } from "../../src/lib/cart";
import { TEXT_MAX } from "../../src/lib/feedback";

const bill = readFileSync(join(__dirname, "../../src/screens/BillScreen.tsx"), "utf8");

describe("phone: ten digits, starts with 6 to 9", () => {
  it("the Bill takes a good number", () => expect(isPhone("9876543210")).toBe(true));
  it("the Bill refuses a number that starts with 0 to 5", () => expect(isPhone("5876543210")).toBe(false));
  it("the Bill refuses too few, too many and letters", () => {
    for (const bad of ["98765", "98765432101", "abcdefghij", ""]) expect(isPhone(bad)).toBe(false);
  });
  it("the sign-in sheet has the same rule", () => {
    for (const [v, ok] of [["9876543210", true], ["5876543210", false], ["98765", false]] as const) expect(isMobile(v)).toBe(ok);
  });
});

describe("the other fields", () => {
  it("pin: six digits", () => {
    expect(isPin("110016")).toBe(true);
    for (const bad of ["1100", "11001a", "1100160", ""]) expect(isPin(bad)).toBe(false);
  });
  it("quantity of a dish: 1 to 20", () => expect(MAX_QTY).toBe(20));
  it("name: 80 characters at most, address 300, coupon code 40 (the Bill's inputs)", () => {
    expect(bill).toMatch(/id="name".*maxLength=\{80\}/);
    expect(bill).toMatch(/id="address".*maxLength=\{300\}/);
    expect(bill).toMatch(/id="code".*maxLength=\{40\}/);
  });
  it("feedback text: the app stops at 300, the database at 2000 (the app is stricter on purpose)", () => {
    expect(TEXT_MAX).toBe(300);
    expect(TEXT_MAX).toBeLessThanOrEqual(2000);
  });
});
