// Story #938: the old joined-session key is removed, and nothing reads it back.
import { describe, expect, it } from "vitest";
import * as session from "../../src/lib/session";

const store = (init: Record<string, string>) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
};

describe("retired join", () => {
  it("S1 dropOldJoin removes the key a past version left", () => {
    const s = store({ "gs-joined-session": "7e57ab1e-0000-4000-8000-0000000000b2" });
    (session as unknown as { dropOldJoin: (st: Storage) => void }).dropOldJoin(s);
    expect(s.getItem("gs-joined-session")).toBeNull();
  });
  it("S2 the join and reset helpers are gone", () => {
    for (const name of ["joinCode", "joinLink", "joinSession", "rememberJoin", "resetSession", "activeSession"]) expect(name in session, name).toBe(false);
  });
});
