// Story 1775 (epic 1753; owner, 22 Nov 2026): the app reads the delivery fee once when it starts and keeps it for this session, in memory only. The Bill shows it at once, and every
// quote and order sends its `as_of` (the server's time, never the phone's) as fee_as_of, so the server charges the fee the customer saw, for up to 12 hours (story 1773, 1774).
import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";

export type LoadedFee = { amount_paise: number; as_of: string };

// null when the read failed or is late: the Bill then sends no fee_as_of and shows a grey bar for the fee (never a made-up Free).
export async function readFee(timeoutMs = 4000): Promise<LoadedFee | null> {
  const read = (async () => {
    const { data, error } = await getClient().rpc("delivery_fee_at_v1", { p_as_of: null });
    return error || !data || !Number.isInteger(data.amount_paise) || typeof data.as_of !== "string" ? null : { amount_paise: data.amount_paise as number, as_of: data.as_of as string };
  })().catch(() => null);
  return await Promise.race([read, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}

// settled: the first read has answered (well or not), so the first quote can carry its as_of instead of being asked twice. reload: a 409 price_changed, or an app open for more than 12 hours,
// takes a fresh as_of; a failed re-read keeps the last good one.
export function useLoadedFee(on: boolean) {
  const [fee, setFee] = useState<LoadedFee | null>(null);
  const [settled, setSettled] = useState(false);
  const reload = useCallback(() => { void readFee().then((f) => { setFee((old) => f ?? old); setSettled(true); }); }, []);
  useEffect(() => { if (on) reload(); }, [on, reload]);
  return { fee, settled: settled || !on, reload };
}
