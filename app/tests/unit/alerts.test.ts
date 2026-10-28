// Story #609: the Order alerts switch always works. Off unsubscribes this phone and remembers it; on subscribes again without a browser prompt.
import { describe, expect, it, vi } from "vitest";
import { alertsState, readOff, turnAlertsOff, writeOff } from "../../src/lib/alerts";

describe("alertsState", () => {
  it("is ask before the phone has answered, none when the phone said no, on or off once it said yes", () => {
    expect(alertsState("default", false)).toBe("ask");
    expect(alertsState("denied", false)).toBe("none");
    expect(alertsState("granted", false)).toBe("on");
    expect(alertsState("granted", true)).toBe("off");
    expect(alertsState(undefined, false)).toBe("none");   // no Notification API
  });
  it("a denied phone stays blocked even if the customer had turned alerts off before", () => {
    expect(alertsState("denied", true)).toBe("none");
    expect(alertsState("default", true)).toBe("ask");
  });
});

describe("readOff and writeOff", () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
  it("remember off and on", () => {
    const s = store();
    expect(readOff(s)).toBe(false);
    writeOff(s, true);
    expect(readOff(s)).toBe(true);
    writeOff(s, false);
    expect(readOff(s)).toBe(false);
  });
  it("a storage that throws means not off, and never throws out", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readOff(bad)).toBe(false);
    expect(() => writeOff(bad, true)).not.toThrow();
  });
});

describe("turnAlertsOff", () => {
  const deps = (over: object = {}) => {
    const calls: string[] = [];
    const d = {
      subscription: vi.fn(async () => ({ endpoint: "https://push.example/abc", unsubscribe: async () => { calls.push("unsubscribe"); return true; } })),
      remove: vi.fn(async () => { calls.push("remove"); return null as string | null; }),
      setOff: vi.fn((v: boolean) => void calls.push("off:" + v)),
      ...over,
    };
    return { d, calls };
  };
  it("removes the server row first, then unsubscribes the phone, then remembers off", async () => {
    const { d, calls } = deps();
    expect(await turnAlertsOff(d)).toBe("off");
    expect(d.remove).toHaveBeenCalledWith("https://push.example/abc");
    expect(calls).toEqual(["remove", "unsubscribe", "off:true"]);
  });
  it("when the server cannot remove the row, nothing else changes and the answer is failed", async () => {
    const { d, calls } = deps({ remove: vi.fn(async () => "boom") });
    expect(await turnAlertsOff(d)).toBe("failed");
    expect(calls).toEqual([]);
  });
  it("a phone with no subscription is simply off", async () => {
    const { d, calls } = deps({ subscription: vi.fn(async () => null) });
    expect(await turnAlertsOff(d)).toBe("off");
    expect(calls).toEqual(["off:true"]);
  });
  it("never throws: an error anywhere is failed", async () => {
    const { d } = deps({ subscription: vi.fn(async () => { throw new Error("no worker"); }) });
    expect(await turnAlertsOff(d)).toBe("failed");
  });
});
