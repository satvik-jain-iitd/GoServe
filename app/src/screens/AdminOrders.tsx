// Today's orders of all kitchens (story A4): who ordered, what, the status, and a cancel with a reason.
import { useCallback, useEffect, useState } from "react";
import { cancelOrder, filterAdminOrders, listTodayOrders, type AdminOrder, type KitchenRow } from "../lib/admin";
import { statusLabel } from "../lib/kitchen";
import { formatRupees } from "../lib/money";
import { getClient } from "../lib/supabase";
import { Button } from "../ui";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const STATUSES = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];

export function AdminOrders({ kitchens, onError }: { kitchens: KitchenRow[]; onError: (m: string | null) => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [kitchen, setKitchen] = useState("");
  const [status, setStatus] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    try { setOrders(await listTodayOrders(getClient())); } catch { onError("Could not load the orders. Try again."); }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);
  const name = (id: string) => kitchens.find((k) => k.id === id)?.name ?? "Kitchen";
  const confirm = async (id: string) => {
    if (!reason.trim()) return onError("Give a reason for the cancel.");
    const failed = await cancelOrder(getClient(), id, reason.trim());
    onError(failed);
    if (!failed) { setCancelling(null); setReason(""); await load(); }
  };
  return (
    <>
      <label>Kitchen filter
        <select aria-label="Kitchen" value={kitchen} onChange={(e) => setKitchen(e.target.value)}>
          <option value="">All kitchens</option>
          {kitchens.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </label>
      <label>Status
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </label>
      <ul className="tickets">
        {filterAdminOrders(orders, kitchen, status).map((o) => (
          <li key={o.id} className="ticket">
            <div className="ticket-head"><strong>{time(o.created_at)} · {name(o.kitchen_id)}</strong><span className={`badge ${o.status}`}>{statusLabel(o.status)}</span></div>
            <p>{o.customer_name ?? "No name"} · {o.customer_phone ?? "No phone"}</p>
            <p className="note">{o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")} · {formatRupees(o.total_paise)}</p>
            <p className="note">{o.address}</p>
            {o.cancel_reason && <p className="note">Cancelled: {o.cancel_reason}</p>}
            {(o.status === "placed" || o.status === "accepted") && cancelling !== o.id && (
              <Button variant="ghost" aria-label={`Cancel order of ${o.customer_name ?? "customer"}`} onClick={() => { onError(null); setCancelling(o.id); }}>Cancel order</Button>
            )}
            {cancelling === o.id && (
              <>
                <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                <Button onClick={() => void confirm(o.id)}>Confirm cancel</Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
