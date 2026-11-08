// Story #995: the Bill and Place order ask the server the same question. With the offers switched off in the app, both say "no coupon", so the total the Bill shows is the total the server computes (it used to pick a personal coupon on its own).
import { describe, it, expect } from "vitest";
import { askFor } from "../../src/lib/quote";

describe("askFor", () => {
  it("with offers off asks for no coupon, whatever was picked", () => {
    expect(askFor(true, { code: "LATE-1", none: false })).toEqual({ code: null, none: true });
    expect(askFor(true, { code: null, none: false })).toEqual({ code: null, none: true });
  });
  it("with offers on keeps the pick: a code, none, or the server's best", () => {
    expect(askFor(false, { code: "LATE-1", none: false })).toEqual({ code: "LATE-1", none: false });
    expect(askFor(false, { code: null, none: true })).toEqual({ code: null, none: true });
    expect(askFor(false, { code: null, none: false })).toEqual({ code: null, none: false });
  });
});
