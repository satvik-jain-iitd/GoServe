// Story #609: the Order alerts switch always works. A page cannot take the browser's permission back, so "off" is this app's own word for this phone:
// the server row and the browser subscription go, and "off" is remembered; "on" subscribes again with no prompt (the permission is still granted).
export type Alerts = "ask" | "on" | "off" | "none";   // none: blocked in the phone settings (or no notifications at all); the switch is off and locked

export const alertsState = (permission: string | undefined, off: boolean): Alerts =>
  permission === "default" ? "ask" : permission === "granted" ? (off ? "off" : "on") : "none";

const KEY = "gs-alerts-off";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const readOff = (s: Store): boolean => { try { return s.getItem(KEY) === "1"; } catch { return false; } };
export const writeOff = (s: Store, off: boolean): void => { try { if (off) s.setItem(KEY, "1"); else s.removeItem(KEY); } catch { /* the choice lasts for this visit only */ } };

type Sub = { endpoint: string; unsubscribe: () => Promise<boolean> };
// The server row goes first, so no push is queued for this phone; only then the browser subscription. A failure changes nothing else.
export async function turnAlertsOff(d: { subscription: () => Promise<Sub | null>; remove: (endpoint: string) => Promise<string | null>; setOff: (off: boolean) => void }): Promise<"off" | "failed"> {
  try {
    const sub = await d.subscription();
    if (sub) {
      if ((await d.remove(sub.endpoint)) !== null) return "failed";
      await sub.unsubscribe();
    }
    d.setOff(true);
    return "off";
  } catch {
    return "failed";
  }
}
