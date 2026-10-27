// Story M.2 (#321, plan v2 H.2): a kitchen's opening hours are obeyed, in India time, on any machine.
import { describe, expect, it } from "vitest";
import { insideHours, isOpenNow } from "../../src/lib/hours";

const at = (hhmm: string) => new Date(`2026-10-24T${hhmm}:00+05:30`);   // an India clock time
const k = (opens_at: string | null, closes_at: string | null, over: object = {}) => ({ open: true, active: true, opens_at, closes_at, ...over });

describe("isOpenNow", () => {
  it("closes at the closing minute: 22:59 open, 23:00 closed, 23:01 closed", () => {
    expect(isOpenNow(k("10:00:00", "23:00:00"), at("22:59"))).toBe(true);
    expect(isOpenNow(k("10:00:00", "23:00:00"), at("23:00"))).toBe(false);
    expect(isOpenNow(k("10:00:00", "23:00:00"), at("23:01"))).toBe(false);
  });
  it("opens at the opening minute", () => {
    expect(isOpenNow(k("10:00:00", "23:00:00"), at("09:59"))).toBe(false);
    expect(isOpenNow(k("10:00:00", "23:00:00"), at("10:00"))).toBe(true);
  });
  it("an overnight kitchen (20:00 to 02:00) is open across midnight", () => {
    const night = k("20:00:00", "02:00:00");
    for (const [t, want] of [["19:59", false], ["20:00", true], ["23:30", true], ["00:00", true], ["01:59", true], ["02:00", false], ["12:00", false]] as const) {
      expect(isOpenNow(night, at(t)), t).toBe(want);
    }
  });
  it("without both hours the switch alone decides", () => {
    expect(isOpenNow(k(null, null), at("03:00"))).toBe(true);
    expect(isOpenNow(k("10:00:00", null), at("03:00"))).toBe(true);
    expect(isOpenNow(k(null, null, { open: false }), at("12:00"))).toBe(false);
  });
  it("the switch and the active flag still close a kitchen inside its hours", () => {
    expect(isOpenNow(k("10:00:00", "23:00:00", { open: false }), at("12:00"))).toBe(false);
    expect(isOpenNow(k("10:00:00", "23:00:00", { active: false }), at("12:00"))).toBe(false);
  });
  it("reads hours with or without seconds and ignores the machine's time zone", () => {
    expect(isOpenNow(k("10:00", "23:00"), at("12:00"))).toBe(true);
    const was = process.env.TZ; process.env.TZ = "America/Los_Angeles";
    expect(isOpenNow(k("10:00:00", "23:00:00"), new Date("2026-10-24T17:29:00Z"))).toBe(true);    // 22:59 India
    expect(isOpenNow(k("10:00:00", "23:00:00"), new Date("2026-10-24T17:30:00Z"))).toBe(false);   // 23:00 India
    if (was === undefined) delete process.env.TZ; else process.env.TZ = was;
  });
});

describe("insideHours (story #452)", () => {
  it("is true only when both hours are set and the time is inside them, whatever the switch says", () => {
    expect(insideHours(k("07:30:00", "22:00:00", { open: false }), at("12:49"))).toBe(true);   // a switched-off kitchen in the middle of its day
    expect(insideHours(k("07:30:00", "22:00:00"), at("23:30"))).toBe(false);
    expect(insideHours(k("20:00:00", "02:00:00"), at("00:30"))).toBe(true);
    expect(insideHours(k("07:30:00", null), at("12:49"))).toBe(false);   // no full hours: the old wording stays
    expect(insideHours(k(null, null), at("12:49"))).toBe(false);
  });
});
