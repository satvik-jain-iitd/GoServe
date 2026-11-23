// Story 1789: the customer's rider card shows a short name: first name up to 12 letters, else initials with dots.
import { describe, it, expect } from "vitest";
import { riderShortName } from "../../src/lib/riderName";

describe("riderShortName", () => {
  it("keeps a short first name", () => expect(riderShortName("Ravi Kumar")).toBe("Ravi"));
  it("keeps exactly 12 letters", () => expect(riderShortName("Abcdefghijkl Z")).toBe("Abcdefghijkl"));
  it("turns 13 letters into initials", () => expect(riderShortName("Abcdefghijklm Zed")).toBe("A.Z."));
  it("uses every word for initials", () => expect(riderShortName("Abcdefghijklmnop Mid Last")).toBe("A.M.L."));
  it("ignores extra spaces", () => { expect(riderShortName("  Ravi   Kumar ")).toBe("Ravi"); expect(riderShortName("  Abcdefghijklmnop   Zed ")).toBe("A.Z."); });
  it("falls back for empty, null, undefined, blank", () => { for (const v of ["", "   ", null, undefined]) expect(riderShortName(v)).toBe("Your rider"); });
  it("keeps the stored fallback whole", () => expect(riderShortName("Your rider")).toBe("Your rider"));
  it("gives one initial and a dot for one long word", () => expect(riderShortName("Abcdefghijklmnopqrstuvwxyz")).toBe("A."));
  it("counts non-ASCII letters, not bytes", () => { expect(riderShortName("Ünïcödéřs Abc")).toBe("Ünïcödéřs"); expect(riderShortName("Éabcdefghijkl Zoë")).toBe("É.Z."); });
});
