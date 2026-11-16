// Story 1586: the customer app's session. A real user passes. A real owner who lost the login gets SessionEnded. A guest with no real owner on the phone (a first visit, or a phone-code
// customer whose user stays anonymous with the phone attached) is left as before: its id is used and no new login is made.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ session: null as null | { user: { id: string; is_anonymous: boolean } }, signUps: 0 }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: {
    getSession: async () => ({ data: { session: h.session } }),
    signInAnonymously: async () => { h.signUps++; return { data: { user: { id: "new-guest" } }, error: null }; },
  } }),
}));
import { ensureCustomerSession, SessionEnded } from "../../src/lib/supabase";

const phone = (owner: string | null, guest: boolean) => {
  const m = new Map<string, string>(); if (owner) m.set("gs-device-user", owner); if (guest) m.set("gs-device-guest", "1");
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => m.get(k) ?? null } });
};

describe("ensureCustomerSession", () => {
  beforeEach(() => { h.session = null; h.signUps = 0; vi.stubEnv("VITE_SUPABASE_URL", "https://t.supabase.co"); vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon"); });

  it("gives a real user's id", async () => {
    phone("u1", false); h.session = { user: { id: "u1", is_anonymous: false } };
    expect(await ensureCustomerSession()).toBe("u1");
  });
  it("throws SessionEnded when the real owner's login is gone, and makes no guest", async () => {
    phone("u1", false);
    await expect(ensureCustomerSession()).rejects.toBeInstanceOf(SessionEnded);
    expect(h.signUps).toBe(0);
  });
  it("throws SessionEnded when only a guest login is left over a real owner", async () => {
    phone("u1", false); h.session = { user: { id: "g", is_anonymous: true } };
    await expect(ensureCustomerSession()).rejects.toBeInstanceOf(SessionEnded);
  });
  it("uses the anonymous user of a phone-code customer when no real owner is on the phone", async () => {
    phone("g", true); h.session = { user: { id: "g", is_anonymous: true } };
    expect(await ensureCustomerSession()).toBe("g");
    expect(h.signUps).toBe(0);
  });
  it("makes a first login on a phone that never had a real user", async () => {
    phone(null, false);
    expect(await ensureCustomerSession()).toBe("new-guest");
  });
});
