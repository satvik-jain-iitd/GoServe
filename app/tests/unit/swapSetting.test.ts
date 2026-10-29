// Story #619 layer d: the admin's swap discount percent mirrors the database rule (whole number, 0 to 50).
import { describe, expect, it } from "vitest";
import { saveSwapSetting, swapPctProblem } from "../../src/lib/swapSetting";

describe("swapPctProblem", () => {
  it("takes 0, 10 and 50", () => { for (const t of ["0", "10", "50"]) expect(swapPctProblem(t)).toBeNull(); });
  it("refuses over 50, under 0, a fraction, nothing and words, with one plain line", () => {
    for (const t of ["51", "-1", "2.5", "", "  ", "ten"]) expect(swapPctProblem(t)).toBe("Pick a whole number from 0 to 50.");
  });
});

describe("saveSwapSetting", () => {
  const rpc = (data: unknown, error: unknown = null) => ({ rpc: async () => ({ data, error }) }) as never;
  it("answers null when saved", async () => expect(await saveSwapSetting(rpc({ ok: true }), 10)).toBeNull());
  it("shows the database's plain line when it refuses", async () => expect(await saveSwapSetting(rpc({ ok: false, message: "Pick a whole number from 0 to 50." }), 60)).toBe("Pick a whole number from 0 to 50."));
  it("shows our line when the call fails", async () => expect(await saveSwapSetting(rpc(null, new Error("down")), 10)).toBe("Could not save. Try again."));
});
