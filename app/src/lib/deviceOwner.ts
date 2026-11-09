// Story #1115 (TC 1.15): the chosen area, the order draft and the alerts choice are kept in the phone's storage, not per account. When a different account signs in on the same
// phone, the first screens would open with the previous person's address (privacy, and food to the wrong place). Before the app reads any of it, the account that is signed in
// now is compared with the one that saved the device state; when they differ the personal keys are cleared and the new account takes the phone. The phone's own settings
// (theme, the phone-code switch's last read) stay. The saved addresses live on the server, so the new account's own list loads as usual.
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export const OWNER_KEY = "gs-device-user";
const PERSONAL = ["gs-pin", "gs-kitchen", "gs-draft", "gs_alerts_asked", "gs-joined-session"];

/** The id of the signed-in user in the Supabase session kept in storage (key sb-<project>-auth-token), or null. */
const signedInId = (s: Store, keys: string[]): string | null => {
  for (const k of keys) {
    if (!/^sb-.*-auth-token$/.test(k)) continue;
    try { const id = JSON.parse(s.getItem(k) ?? "null")?.user?.id; if (typeof id === "string" && id) return id; } catch { /* not a session */ }
  }
  return null;
};

/** Answers true when it cleared another account's state (the caller may then reload, because the screens already hold the old state in memory). */
export function claimDevice(s: Store = window.localStorage): boolean {
  try {
    const me = signedInId(s, storageKeys(s));
    if (!me) return false;
    const owner = s.getItem(OWNER_KEY);
    const other = !!owner && owner !== me;
    if (other) for (const k of PERSONAL) s.removeItem(k);
    if (owner !== me) s.setItem(OWNER_KEY, me);
    return other;
  } catch { return false; /* blocked storage: the old behaviour */ }
}

function storageKeys(s: Store): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) out.push(k); }
  return out;
}
