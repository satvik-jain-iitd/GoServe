// Story 1668 (layer B): the customer's drop code, read from the server while the order is on the way.
// Any answer that is not a code (switch off, no_code, a failed or slow read) gives null: the screen shows no box and no error.
import { useEffect, useState } from "react";
import { getClient } from "./supabase";

export function useDeliveryCode(orderId: string, status: string): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    setCode(null);
    if (status !== "out_for_delivery") return;
    let live = true;   // a read that lands after the status moved on is dropped
    (async () => {
      try {
        const { data, error } = await getClient().rpc("order_code_v1", { p_order_id: orderId });
        const c = (data as { ok?: boolean; drop_code?: unknown } | null)?.drop_code;
        if (live && !error && (data as { ok?: boolean }).ok === true && typeof c === "string" && /^\d{4,6}$/.test(c)) setCode(c);
      } catch { /* no box */ }
    })();
    return () => { live = false; };
  }, [orderId, status]);
  return code;
}
