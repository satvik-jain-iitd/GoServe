// Story #554: order alerts on a phone wrapper (Android or iOS). A browser uses the web push (push.ts); a wrapper that hands over a device token also registers it
// with POST /push/register, with its platform, so FCM or APNs can reach it.
// PLACEHOLDER (owner click): FCM and Apple Developer — no wrapper bridge exists yet, so no real device token is ever handed over. When the owner has the Firebase
// project and the Apple key: the wrapper sets `window.GoServeNative = { platform, pushToken }`, `bridgeBuilt` below becomes true, VITE_PUSH_NATIVE=real is set in
// .github/workflows/deploy-app.yml. The backend half is supabase/functions/_shared/fcm.ts and apns.ts. Both are listed under the FCM and Apple rows of
// docs/product/founder-checklist.md ("code seam").
import { getClient } from "./supabase";

type Env = { VITE_PUSH_NATIVE?: string };
type Wrapper = { GoServeNative?: { platform?: string; pushToken?: () => Promise<string> } };
export type Native = { platform: "android" | "ios"; token: string };

const bridgeBuilt = false;
export const placeholderLeft = (env: Env): boolean => env.VITE_PUSH_NATIVE === "real" && !bridgeBuilt;

// null in a browser, and for anything we do not send to: the web push then does the job alone.
export async function wrapperToken(w: object): Promise<Native | null> {
  const n = (w as Wrapper).GoServeNative;
  if (!n || (n.platform !== "android" && n.platform !== "ios") || typeof n.pushToken !== "function") return null;
  try {
    const token = (await n.pushToken()).trim();
    return token ? { platform: n.platform, token } : null;
  } catch {
    return null;
  }
}

export async function registerNative(d: Native): Promise<boolean> {
  try {
    const session = (await getClient().auth.getSession()).data.session?.access_token ?? "";
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push/register`, {
      method: "POST", headers: { "content-type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, authorization: `Bearer ${session}` }, body: JSON.stringify(d),
    });
    return res.ok && (await res.json().catch(() => null))?.ok === true;
  } catch {
    return false;
  }
}
