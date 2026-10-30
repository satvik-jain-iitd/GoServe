// Story S-M1 (#117): Sign in with Google is linked to the anonymous user, so the session id never changes (ADR-010, ADR-016).
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { linkGoogle, rememberReturn, signedInName, takeReturn } from "../../src/lib/auth";

describe("linkGoogle", () => {
  it("links a Google identity to the current user and comes back to the same page", async () => {
    const linkIdentity = vi.fn().mockResolvedValue({ data: {}, error: null });
    await expect(linkGoogle({ auth: { linkIdentity } }, "https://goserve-app.pages.dev/customer/")).resolves.toBeNull();
    expect(linkIdentity).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://goserve-app.pages.dev/customer/" } });
  });
  it("answers a plain message when Google or the link fails, and keeps the anonymous user", async () => {
    const linkIdentity = vi.fn().mockResolvedValue({ data: {}, error: { message: "boom" } });
    await expect(linkGoogle({ auth: { linkIdentity } }, "https://x/")).resolves.toBe("Could not start Google sign-in. Try again.");
  });
});

describe("linkGoogle in sign-in mode (story S-M5)", () => {
  it("signs in as the Google user instead of linking, for the kitchen, rider and ops apps", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });
    const linkIdentity = vi.fn();
    await expect(linkGoogle({ auth: { linkIdentity, signInWithOAuth } }, "https://x/kitchen/", "signin")).resolves.toBeNull();
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://x/kitchen/" } });
    expect(linkIdentity).not.toHaveBeenCalled();
  });
});

describe("signedInName", () => {
  it("is null for an anonymous user", () => {
    expect(signedInName({ is_anonymous: true, user_metadata: {} })).toBeNull();
    expect(signedInName(null)).toBeNull();
  });
  it("reads the Google name, then falls back to the email", () => {
    expect(signedInName({ is_anonymous: false, user_metadata: { full_name: "Asha Rao" }, email: "a@x.com" })).toBe("Asha Rao");
    expect(signedInName({ is_anonymous: false, user_metadata: {}, email: "a@x.com" })).toBe("a@x.com");
  });
});

import { authErrorFrom, friendlyAuth, ALREADY_IN_USE } from "../../src/lib/auth";
describe("authErrorFrom", () => {
  it("reads error_description from the return address, in the query or the hash", () => {
    expect(authErrorFrom("?error=server_error&error_description=Identity+is+already+linked", "")).toBe("Identity is already linked");
    expect(authErrorFrom("", "#error=access_denied&error_description=Access+denied")).toBe("Access denied");
  });
  it("is null when nothing went wrong", () => {
    expect(authErrorFrom("?join=abc", "")).toBeNull();
  });
});

// Story #635: a Google identity that is already on another user is not an error to show: the app signs in to that user. Raw text from the auth server never reaches the screen.
describe("friendlyAuth", () => {
  it("an identity already linked to another user means: say so kindly and sign in to that user", () => {
    expect(friendlyAuth("?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user", "")).toEqual({ message: ALREADY_IN_USE, signIn: true });
    expect(friendlyAuth("", "#error=server_error&error_description=Identity+is+already+linked+to+another+user")).toEqual({ message: ALREADY_IN_USE, signIn: true });
  });
  it("any other failure gets our own line, never the server's words", () => {
    expect(friendlyAuth("", "#error=access_denied&error_description=Access+denied")).toEqual({ message: "Could not sign in with Google. Try again.", signIn: false });
    expect(JSON.stringify(friendlyAuth("?error=x&error_description=secret+db+text", ""))).not.toContain("secret");
  });
  it("no error in the address means nothing to show", () => {
    expect(friendlyAuth("?join=abc", "")).toBeNull();
  });
  it("ALREADY_IN_USE is the line from the story", () => {
    expect(ALREADY_IN_USE).toBe("This Google account is already in use. Signing you in.");
  });
});

// Story #801: back from Google the app opens the screen the tap came from. The welcome screen (#667) shows the same button to a
// first-time customer, and they came for the menu, not for an empty account page.
describe("where Google comes back to (story #801)", () => {
  const withStorage = (fn: () => void) => {
    const store = new Map<string, string>();
    (globalThis as any).window = { sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } };
    try { fn(); } finally { delete (globalThis as any).window; }
  };

  it("a tap on You comes back to You", () => {
    withStorage(() => { rememberReturn("account"); expect(takeReturn()).toBe(true); });
  });
  it("a tap on the welcome screen comes back to the menu", () => {
    withStorage(() => { rememberReturn("menu"); expect(takeReturn()).toBe(false); });
  });
  it("the choice is read once, so a later visit is not steered by it", () => {
    withStorage(() => { rememberReturn("account"); expect(takeReturn()).toBe(true); expect(takeReturn()).toBe(false); });
  });
  it("no choice stored opens the menu", () => {
    withStorage(() => { expect(takeReturn()).toBe(false); });
  });

  // The wiring is the bug: SignIn called rememberReturn() on every tap, whatever screen it sat on.
  const src = (p: string) => readFileSync(resolve(__dirname, "../../src", p), "utf8");
  it("SignIn always says where it is, and defaults to the menu", () => {
    const t = src("screens/SignIn.tsx");
    expect(t).toMatch(/returnTo\s*=\s*"menu"/);                 // the default is the safe one
    expect(t).not.toMatch(/rememberReturn\(\s*\)/);             // never the old no-argument call
    for (const m of t.matchAll(/rememberReturn\(([^)]*)\)/g)) expect(m[1].trim()).toBe("returnTo");
  });
  it("only You asks to come back to You", () => {
    expect(src("screens/AccountScreen.tsx")).toMatch(/returnTo="account"/);
    for (const p of ["screens/OtpSheet.tsx", "screens/KitchenGate.tsx", "screens/RiderGate.tsx", "screens/AdminScreen.tsx", "App.tsx"]) {
      expect(src(p), p).not.toMatch(/returnTo="account"/);
    }
  });
});
