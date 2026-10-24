// Story #52, S1-S3: which session a device uses (its own, or one it joined by link) and the reset call.
import { describe, expect, it } from "vitest";
import { activeSession, joinCode, joinLink, myKitchen, rememberJoin, resetSession, scopeFor } from "../../src/lib/session";

const A = "7e57ab1e-0000-4000-8000-0000000000a1";
const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
};

describe("joinCode", () => {
  it("reads the session id from ?join=", () => {
    expect(joinCode(`?join=${A}`)).toBe(A);
  });
  it("ignores anything that is not an id", () => {
    expect(joinCode("?join=hello")).toBeNull();
    expect(joinCode("?join=")).toBeNull();
    expect(joinCode("")).toBeNull();
  });
});

describe("activeSession", () => {
  it("is the device's own session until it joins another", () => {
    const s = store();
    expect(activeSession("own-1", s)).toBe("own-1");
    rememberJoin(A, s);
    expect(activeSession("own-1", s)).toBe(A);
  });
});

describe("joinLink", () => {
  it("is the app address with ?join=<session>", () => {
    expect(joinLink("https://app.test/", A)).toBe(`https://app.test/?join=${A}`);
    expect(joinLink("https://app.test/?join=other#x", A)).toBe(`https://app.test/?join=${A}`);
  });
});

describe("resetSession", () => {
  it("calls the database function for this session", async () => {
    const seen: unknown[] = [];
    const client = { rpc: async (name: string, args: object) => (seen.push(name, args), { data: { orders: 2 }, error: null }) };
    await resetSession(client as never, A);
    expect(seen).toEqual(["reset_session", { p_session: A }]);
  });
  it("throws a plain message when the database says no", async () => {
    const client = { rpc: async () => ({ data: null, error: { message: "not_your_session" } }) };
    await expect(resetSession(client as never, A)).rejects.toThrow("Could not reset. Try again.");
  });
});

describe("scopeFor (story S-M5)", () => {
  it("reads by kitchen when the user is kitchen staff", () => {
    expect(scopeFor("k-1", A)).toEqual({ column: "kitchen_id", value: "k-1" });
  });
  it("reads by session otherwise", () => {
    expect(scopeFor(null, A)).toEqual({ column: "session_id", value: A });
  });
});

describe("myKitchen (story S-M5)", () => {
  const client = (res: object) => ({ from: () => ({ select: () => ({ limit: async () => res }) }) }) as never;
  it("answers the kitchen id of the staff row", async () => {
    expect(await myKitchen(client({ data: [{ kitchen_id: "k-1" }], error: null }))).toBe("k-1");
  });
  it("answers null when there is no row or the read fails", async () => {
    expect(await myKitchen(client({ data: [], error: null }))).toBeNull();
    expect(await myKitchen(client({ data: null, error: { message: "x" } }))).toBeNull();
  });
});
