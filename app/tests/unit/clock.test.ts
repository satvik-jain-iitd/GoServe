// Story #660 (copy audit A.1, E.3, F.3): every time in the customer app is written h:mm am/pm, lower case.
import { describe, expect, it } from "vitest";
import { clock12 } from "../../src/lib/clock";

const at = (h: number, m: number) => new Date(2026, 9, 28, h, m);

describe("clock12", () => {
  it("writes the 24-hour time as 12-hour", () => {
    expect(clock12(at(20, 12))).toBe("8:12 pm");
    expect(clock12(at(0, 5))).toBe("12:05 am");
    expect(clock12(at(12, 0))).toBe("12:00 pm");
    expect(clock12(at(9, 7))).toBe("9:07 am");
  });
});
