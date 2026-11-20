// Story #1659 layer 2: the admin's support phone input rules.
import { describe, expect, it } from "vitest";
import { showPhone, supportPhoneProblem } from "../../src/lib/supportPhone";

const BAD = "Type a 10-digit mobile number.";
describe("supportPhoneProblem", () => {
  it("empty is fine (it clears the number)", () => expect(supportPhoneProblem("")).toBeNull());
  it("a good 10-digit number is fine", () => expect(supportPhoneProblem("9000000000")).toBeNull());
  it("spaces are dropped", () => expect(supportPhoneProblem("90000 00000")).toBeNull());
  it("9 digits is an error", () => expect(supportPhoneProblem("900000000")).toBe(BAD));
  it("11 digits is an error", () => expect(supportPhoneProblem("90000000001")).toBe(BAD));
  it("letters are an error", () => expect(supportPhoneProblem("90000abcde")).toBe(BAD));
  it("a +91 prefix is a plain error", () => expect(supportPhoneProblem("+91 9000000000")).toBe(BAD));
  it("a leading 0 is a plain error", () => expect(supportPhoneProblem("09000000000")).toBe(BAD));
  it("a first digit of 5 is an error", () => expect(supportPhoneProblem("5000000000")).toBe(BAD));
});

describe("showPhone", () => {
  it("shows 5 and 5 with a space", () => expect(showPhone("9000000000")).toBe("90000 00000"));
});
