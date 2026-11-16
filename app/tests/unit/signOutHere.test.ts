// Story 1583: a Sign out button ends this phone's login only. The default scope is global and ends the same person's logins everywhere.
import { describe, expect, it, vi } from "vitest";
import { isLeaving, signOutHere } from "../../src/lib/supabase";

describe("signOutHere", () => {
  it("asks the auth client to sign out with scope local", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await signOutHere({ auth: { signOut } } as never);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("marks this tab as leaving, so the customer app's SIGNED_OUT listener makes no guest (story 1586)", async () => {
    await signOutHere({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } } as never);
    expect(isLeaving()).toBe(true);
  });
});
