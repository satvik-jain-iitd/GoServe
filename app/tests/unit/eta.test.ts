// Story #1015 (board E2a): the delivery time line is built only from what the server gave.
import { describe, it, expect } from "vitest";
import { etaView } from "../../src/lib/eta";

const AT = "2026-11-08T14:00:00Z";
const t = (min: number) => new Date(AT).getTime() + min * 60_000;

describe("etaView", () => {
  it("S1 no answer yet, or no number from the server: working it out, never a fixed 20", () => {
    expect(etaView(null, t(0))).toEqual({ kind: "working" });
    expect(etaView({ lo: null, late: false, at: AT }, t(0))).toEqual({ kind: "working" });
  });
  it("S2 the server's lo minutes and the clock they land on; the number counts down between answers and stops at 1", () => {
    expect(etaView({ lo: 25, late: false, at: AT }, t(0))).toEqual({ kind: "time", min: 25, by: new Date(t(25)) });
    expect(etaView({ lo: 25, late: false, at: AT }, t(10))).toMatchObject({ min: 15 });
    expect(etaView({ lo: 25, late: false, at: AT }, t(10.5))).toMatchObject({ min: 15 });   // part of a minute rounds up
    expect(etaView({ lo: 25, late: false, at: AT }, t(40))).toMatchObject({ min: 1 });
  });
  it("S3 past the promise the line says running late, whatever the number", () => {
    expect(etaView({ lo: 25, late: true, at: AT }, t(0))).toEqual({ kind: "late" });
  });
});
