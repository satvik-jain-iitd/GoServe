// Story #1261 (epic #1259, board P6-BillDoor): the ways to pay at the door that Admin has on. Nothing is charged at order time.
import type { SupabaseClient } from "@supabase/supabase-js";

export type DoorMethod = "cash" | "upi_door";
export const DOOR_METHODS: { id: DoorMethod; label: string; sub: string | null }[] = [
  { id: "cash", label: "Cash at the door", sub: null },
  { id: "upi_door", label: "UPI at the door", sub: "Scan the rider's QR with any UPI app" },
];

/** The list that is on, in the order the bill shows it. A read that fails, or an answer that makes no sense, is an empty list: the bill then names no method, because naming one it may not have is a lie. */
export async function fetchDoorMethods(c: SupabaseClient): Promise<DoorMethod[]> {
  try {
    const { data, error } = await c.rpc("payment_methods_on");
    const on = Array.isArray(data) ? data : [];
    const list = DOOR_METHODS.map((m) => m.id).filter((id) => on.includes(id));
    return error ? [] : list;
  } catch {
    return [];
  }
}
