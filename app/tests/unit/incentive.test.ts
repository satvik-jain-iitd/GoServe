// Stories 1443 and 1438: each delivery counts at the rate in force when it was delivered.
import { describe, expect, it } from "vitest";
import { incentiveFor } from "../../src/lib/incentive";

const d = (t: string) => ({ updated_at: `2026-11-14T${t}:00Z` });
describe("incentiveFor", () => {
  it("before the first change it is off", () => {
    expect(incentiveFor([d("05:00")], [])).toEqual({ count: 0, total_paise: 0, amounts: [] });
  });
  it("on at Rs 10 with 4 deliveries is Rs 40", () => {
    expect(incentiveFor([d("05:00"), d("06:00"), d("07:00"), d("08:00")], [{ at: "2026-11-14T04:00:00Z", on: true, amount_paise: 1000 }])).toEqual({ count: 4, total_paise: 4000, amounts: [1000] });
  });
  it("a change at noon: earlier deliveries at the old amount, later ones at the new; off counts nothing", () => {
    const log = [{ at: "2026-11-14T04:00:00Z", on: true, amount_paise: 1000 }, { at: "2026-11-14T06:30:00Z", on: true, amount_paise: 2000 }, { at: "2026-11-14T08:30:00Z", on: false, amount_paise: 2000 }];
    expect(incentiveFor([d("05:00"), d("06:00"), d("07:00"), d("09:00")], log)).toEqual({ count: 3, total_paise: 4000, amounts: [1000, 2000] });
  });
});
