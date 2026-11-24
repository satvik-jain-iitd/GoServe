// Story 1666 (epic 1652): the rider's pick-up code, shown only while the Kitchen handoff code switch is on (pickup_code_on()) and the order is Ready.
// order_code_v1 gives the rider the pickup code whether the switch is on or not, so the switch is read here too. Any answer that is not a code
// (switch off, a failed read of the switch or of the code) gives null: the screen stays as it is today, with no box and no error text.
import { useEffect, useState } from "react";
import { getClient } from "./supabase";

export function usePickupCode(orderId: string | null, active: boolean): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    setCode(null);
    if (!orderId || !active) return;
    let live = true;   // a read that lands after the order moved on is dropped
    const read = async () => {
      try {
        const on = await getClient().rpc("pickup_code_on");
        if (on.error || on.data !== true) { if (live) setCode(null); return; }
        const { data, error } = await getClient().rpc("order_code_v1", { p_order_id: orderId });
        const c = (data as { ok?: boolean; role?: string; pickup_code?: unknown } | null)?.pickup_code;
        const ok = !error && (data as { ok?: boolean; role?: string } | null)?.ok === true && (data as { role?: string }).role === "rider" && typeof c === "string" && /^\d{4,6}$/.test(c);
        if (live) setCode(ok ? (c as string) : null);
      } catch { if (live) setCode(null); }
    };
    void read();
    const onVisible = () => { if (document.visibilityState === "visible") void read(); };   // a switch flipped while the phone slept
    document.addEventListener("visibilitychange", onVisible);
    return () => { live = false; document.removeEventListener("visibilitychange", onVisible); };
  }, [orderId, active]);
  return code;
}

// Story 1667: the kitchen's side. The Enter code button shows only while the switch is on; any failed read of the switch means off (the screen stays as today).
export function useCodeSwitch(name: "pickup_code_on" | "drop_code_on", active: boolean, tick: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const read = async () => {
      try { const r = await getClient().rpc(name); if (live) setOn(!r.error && r.data === true); } catch { if (live) setOn(false); }
    };
    void read();
    const onVisible = () => { if (document.visibilityState === "visible") void read(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { live = false; document.removeEventListener("visibilitychange", onVisible); };
  }, [name, active, tick]);
  return on;
}

export type CodeAnswer = { kind: "ok" } | { kind: "wrong" } | { kind: "locked" } | { kind: "off" } | { kind: "net" } | { kind: "other"; message: string };
// The kitchen types the rider's code. Any answer we cannot read is "net": we do not know, so the cook types again.
export const kitchenHandover = (orderId: string, code: string) => sendCode("kitchen_handover_v1", { p_order: orderId, p_code: code });
// Story 1669: the rider types the customer's code at the door; the right code delivers the order with the way it was paid.
export const riderDeliver = (orderId: string, code: string, method: string) => sendCode("rider_deliver_v1", { p_order: orderId, p_code: code, p_method: method });
async function sendCode(fn: string, args: Record<string, string>): Promise<CodeAnswer> {
  try {
    const { data, error } = await getClient().rpc(fn, args);
    const d = data as { ok?: boolean; error?: string; message?: string } | null;
    if (error || !d || typeof d !== "object") return { kind: "net" };
    if (d.ok === true) return { kind: "ok" };
    if (d.error === "wrong_code") return { kind: "wrong" };
    if (d.error === "code_locked") return { kind: "locked" };
    if (d.error === "switch_off") return { kind: "off" };
    return { kind: "other", message: d.message || "We could not check the code. Check your internet and type it again." };
  } catch { return { kind: "net" }; }
}

// Story 1666, the trip: one code per packet. null = the switch is off (or not read yet): today's trip. Otherwise the switch is on: `codes` holds the codes read
// so far (they stay when a packet goes On the way and its code can no longer be read), `complete` says every packet has one, `failed` says the last read
// did not get them (no network), and the read is tried again when the connection is back.
export type TripCodes = { codes: Record<string, string>; complete: boolean; failed: boolean };
export function usePickupCodes(ids: string[], active: boolean): TripCodes | null {
  const key = ids.join(",");
  const [on, setOn] = useState(false);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active) { setOn(false); setCodes({}); setFailed(false); return; }
    let live = true;
    const read = async () => {
      try {
        const sw = await getClient().rpc("pickup_code_on");
        if (!live) return;
        if (sw.error || sw.data !== true) { setOn(false); setCodes({}); setFailed(false); return; }
        const got: Record<string, string> = {};
        await Promise.all(key.split(",").map(async (id) => {
          const { data, error } = await getClient().rpc("order_code_v1", { p_order_id: id });
          const d = data as { ok?: boolean; role?: string; pickup_code?: unknown } | null;
          if (!error && d?.ok === true && d.role === "rider" && typeof d.pickup_code === "string" && /^\d{4,6}$/.test(d.pickup_code)) got[id] = d.pickup_code;
        }));
        if (live) { setOn(true); setCodes((cur) => ({ ...cur, ...got })); setFailed(Object.keys(got).length < key.split(",").length); }
      } catch { if (live) { setOn(true); setFailed(true); } }   // the switch could not be read either: say so, never fall back to a button the server refuses
    };
    void read();
    const onVisible = () => { if (document.visibilityState === "visible") void read(); };
    const onOnline = () => void read();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => { live = false; document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onOnline); };
  }, [key, active]);
  if (!on) return null;
  const complete = ids.length > 0 && ids.every((id) => codes[id]);
  return { codes, complete, failed: failed && !complete };
}
