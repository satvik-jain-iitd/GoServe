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
