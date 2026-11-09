// Story #1115 (TC 1.15): the chosen area, the order draft and the alerts choice are kept in the phone's storage, not per account. When a different account signs in on the same
// phone, the first screens would open with the previous person's address (privacy, and food to the wrong place). Before the app reads any of it, the account that is signed in
// now is compared with the one that saved the device state; when they differ the personal keys are cleared and the new account takes the phone. The phone's own settings
// (theme, the phone-code switch's last read) stay. The saved addresses live on the server, so the new account's own list loads as usual.
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export const OWNER_KEY = "gs-device-user";
const PERSONAL = ["gs-pin", "gs-kitchen", "gs-draft", "gs_alerts_asked", "gs-joined-session"];

/** The id of the signed-in user in the Supabase session kept in storage (key sb-<project>-auth-token), or null. */
const signedIn = (s: Store, keys: string[]): { id: string; guest: boolean } | null => {
  for (const k of keys) {
    if (!/^sb-.*-auth-token$/.test(k)) continue;
    try { const u = JSON.parse(s.getItem(k) ?? "null")?.user; if (typeof u?.id === "string" && u.id) return { id: u.id, guest: u.is_anonymous === true }; } catch { /* not a session */ }
  }
  return null;
};
export const GUEST_KEY = "gs-device-guest";   // "1" when the account that holds the phone is a guest (an anonymous login)

/** Answers true when it cleared another account's state (the caller may then reload, because the screens already hold the old state in memory). */
export function claimDevice(s: Store = window.localStorage, live = false): boolean {
  try {
    const who = signedIn(s, storageKeys(s));
    if (!who) return false;
    const me = who.id;
    const owner = s.getItem(OWNER_KEY);
    // Live (a sign-in in this same tab): a guest who signs in to an account is the same person finishing their own order, so their area and draft go with them.
    const other = !!owner && owner !== me && !(live && s.getItem(GUEST_KEY) === "1");
    if (other) for (const k of PERSONAL) s.removeItem(k);
    if (owner !== me) s.setItem(OWNER_KEY, me);
    if (who.guest) s.setItem(GUEST_KEY, "1"); else s.removeItem(GUEST_KEY);
    return other;
  } catch { return false; /* blocked storage: the old behaviour */ }
}

function storageKeys(s: Store): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) out.push(k); }
  return out;
}
