// Story S-M1 (#117): Sign in with Google is linked to the anonymous user, so the session id never changes (ADR-010, ADR-016).
import { describe, expect, it, vi } from "vitest";
import { linkGoogle, signedInName } from "../../src/lib/auth";

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

import { authErrorFrom } from "../../src/lib/auth";
describe("authErrorFrom", () => {
  it("reads error_description from the return address, in the query or the hash", () => {
    expect(authErrorFrom("?error=server_error&error_description=Identity+is+already+linked", "")).toBe("Identity is already linked");
    expect(authErrorFrom("", "#error=access_denied&error_description=Access+denied")).toBe("Access denied");
  });
  it("is null when nothing went wrong", () => {
    expect(authErrorFrom("?join=abc", "")).toBeNull();
  });
});
