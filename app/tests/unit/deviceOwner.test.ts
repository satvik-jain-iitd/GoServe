// Story #1115 (TC 1.15): the area, address draft and alerts choice are kept per device; a different account on the same phone must not see another account's.
// claimDevice runs before the app reads any of it: when the signed-in user is not the one who saved the device state, the personal keys are cleared.
import { describe, expect, it } from "vitest";
import { claimDevice, OWNER_KEY } from "../../src/lib/deviceOwner";

const mem = (init: Record<string, string> = {}) => { const m = { ...init }; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v; }, removeItem: (k: string) => { delete m[k]; }, key: (i: number) => Object.keys(m)[i] ?? null, get length() { return Object.keys(m).length; }, dump: () => m }; };
const session = (id: string | null): Record<string, string> => (id ? { "sb-abc-auth-token": JSON.stringify({ user: { id } }) } : {});
const MINE = { "gs-pin": "110016", "gs-kitchen": "{}", "gs-draft": "{}", gs_alerts_asked: "1" };

describe("claimDevice", () => {
  it("a different account clears the area, the draft and the alerts choice, and takes the device", () => {
    const s = mem({ ...session("B"), ...MINE, [OWNER_KEY]: "A", "gs-theme": "night" });
    claimDevice(s);
    expect(s.dump()).toEqual({ ...session("B"), "gs-theme": "night", [OWNER_KEY]: "B" });   // the theme is the phone's, it stays
  });
  it("the same account keeps everything", () => {
    const s = mem({ ...session("A"), ...MINE, [OWNER_KEY]: "A" });
    claimDevice(s);
    expect(s.dump()).toEqual({ ...session("A"), ...MINE, [OWNER_KEY]: "A" });
  });
  it("a phone that never had an owner keeps what it has and records the account", () => {
    const s = mem({ ...session("A"), ...MINE });
    claimDevice(s);
    expect(s.dump()).toEqual({ ...session("A"), ...MINE, [OWNER_KEY]: "A" });
  });
  it("no session yet: nothing changes", () => {
    const s = mem({ ...MINE, [OWNER_KEY]: "A" });
    claimDevice(s);
    expect(s.dump()).toEqual({ ...MINE, [OWNER_KEY]: "A" });
  });
  it("blocked storage never throws", () => {
    expect(() => claimDevice({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); }, key: () => null, length: 1 })).not.toThrow();
  });
});
