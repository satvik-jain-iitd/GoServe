// Orders of the admin app on the Ink v3 boards A3 and A4 (story H12, #195; story A4): today's orders, live then done, and one order with its slip, the calls, the timeline and a cancel with a reason.
import { useCallback, useEffect, useState } from "react";
import { cancelOrder, doneOrders, listTodayOrders, liveOrders, type AdminOrder, type KitchenRow } from "../lib/admin";
import { hhmm, shortId, statusLabel, trackerSteps } from "../lib/kitchen";
import { formatRupees } from "../lib/money";
import { getClient } from "../lib/supabase";
import { Timeline } from "../ui";

const TAG: Record<string, string> = { placed: "placed", accepted: "placed", preparing: "", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "error" };
const WORD: Record<string, string> = { placed: "New", accepted: "Accepted", preparing: "Cooking" };
const STAMP: Record<string, string> = { placed: "placed", accepted: "accepted", preparing: "cooking", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "error" };
const STEP_WORDS: Record<string, string> = { ready: "Ready, rider picks up" };
const CALL = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;

type Props = { kitchens: KitchenRow[]; onError: (m: string | null) => void; open: string | null; onOpen: (id: string | null) => void; onCount?: (live: number, total: number) => void };

export function AdminOrders({ kitchens, onError, open, onOpen, onCount }: Props) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    try { setOrders(await listTodayOrders(getClient())); } catch { onError("Could not load the orders. Try again."); }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);
  const live = liveOrders(orders), done = doneOrders(orders);
  useEffect(() => { onCount?.(live.length, orders.length); }, [live.length, orders.length, onCount]);
  const kitchen = (id: string) => kitchens.find((k) => k.id === id);
  const confirm = async (id: string) => {
    if (!reason.trim()) return onError("Give a reason for the cancel.");
    const failed = await cancelOrder(getClient(), id, reason.trim());
    onError(failed);
    if (!failed) { setCancelling(false); setReason(""); await load(); }
  };
  const row = (o: AdminOrder) => (
    <button key={o.id} type="button" className="ui-order-row" aria-label={`Open order ${shortId(o.id)}, ${o.customer_name ?? "no name"}`} onClick={() => onOpen(o.id)}>
      <span className="ui-order-main">
        <span className="mono ui-order-no">No. {shortId(o.id)} · {hhmm(o.created_at)}</span>
        <span className="ui-order-items">{o.customer_name ?? "No name"}</span>
        <span className="ui-order-sub">{kitchen(o.kitchen_id)?.name ?? "Kitchen"} · <span className="mono">{formatRupees(o.total_paise)}</span></span>
      </span>
      <span className={`ui-tag ${TAG[o.status] ?? ""}`}>{WORD[o.status] ?? statusLabel(o.status)}</span>
    </button>
  );
  const o = open ? orders.find((x) => x.id === open) ?? null : null;
  if (o) {   // A4
    const k = kitchen(o.kitchen_id);
    const steps = trackerSteps(o.status);
    const canCancel = o.status === "placed" || o.status === "accepted";
    return (
      <>
        <header className="ui-head">
          <button type="button" className="ui-back" aria-label="Back to orders" onClick={() => { setCancelling(false); onOpen(null); }}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
          <h1>Order</h1>
          <span className="meta">No. {shortId(o.id)}</span>
        </header>
        <div className="ui-scroll">
          <section className="ui-slip ui-slip-pad" aria-label={`Order ${shortId(o.id)}`}>
            <div className="ui-slip-body">
              <div className="ui-slip-head"><span>{k?.name ?? "Kitchen"}</span><span>Cash</span></div>
              <div className="ui-slip-stamp"><span className={`ui-stamp ${STAMP[o.status] ?? ""}`}>{WORD[o.status] ?? statusLabel(o.status)}</span></div>
              <div className="ui-slip-lines">{o.items.map((i, n) => <div key={n}><span>{i.qty} × {i.name}</span>{i.price_paise !== undefined && <span>{formatRupees(i.price_paise * i.qty)}</span>}</div>)}</div>
              <div className="ui-slip-rule" />
              <p className="ui-addr mono">{o.address}</p>
              <div className="ui-slip-rule" />
              <div className="ui-slip-total"><b>Cash at door</b><span>{formatRupees(o.total_paise)}</span></div>
              {o.cancel_reason && <p className="ui-meta">Cancelled: {o.cancel_reason}</p>}
            </div>
          </section>
          <section className="ui-group ui-pad" aria-label="Call">
            <h2>Call</h2>
            <div className="ui-row ui-row-static ui-row-tall"><span className="ui-row-label"><span>{o.customer_name ?? "No name"}</span><span className="ui-row-sub mono">Customer{o.customer_phone ? ` · ${o.customer_phone}` : ""}</span></span>
              {o.customer_phone && <a className="ui-btn ghost icon" href={`tel:${o.customer_phone}`} aria-label={`Call ${o.customer_name ?? "customer"}`}>{CALL}</a>}</div>
            <div className="ui-row ui-row-static ui-row-tall"><span className="ui-row-label"><span>{k?.name ?? "Kitchen"}</span><span className="ui-row-sub mono">Kitchen{k?.phone ? ` · ${k.phone}` : ""}</span></span>
              {k?.phone && <a className="ui-btn ghost icon" href={`tel:${k.phone}`} aria-label={`Call ${k.name}`}>{CALL}</a>}</div>
            <div className="ui-row ui-row-static ui-row-tall"><span className="ui-row-label"><span>{o.rider_id ? "Rider assigned" : "No rider yet"}</span><span className="ui-row-sub mono">Rider</span></span><span className="mono ui-row-sub">{o.rider_id ? "On the job" : "Not assigned yet"}</span></div>
          </section>
          {o.status !== "cancelled" && <div className="ui-pad"><Timeline steps={steps.map((s) => STEP_WORDS[s.status] ?? s.label)} current={steps.findIndex((s) => s.state === "current")} label="Order status" /></div>}
          {cancelling && (
            <div className="ui-form ui-pad">
              <div className="ui-field"><label htmlFor="cancel-reason">Reason</label><input id="cancel-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            </div>
          )}
        </div>
        {canCancel && (
          <div className="ui-bottom">
            {cancelling ? <button type="button" className="ui-btn big danger" onClick={() => void confirm(o.id)}>Confirm cancel</button>
              : <button type="button" className="ui-btn ghost big danger" onClick={() => { onError(null); setCancelling(true); }}>Cancel order</button>}
          </div>
        )}
      </>
    );
  }
  return (   // A3
    <div className="ui-scroll ui-orders">
      <section className="ui-group" aria-label="Live"><h2>Live <span className="mono">{live.length}</span></h2>{live.length === 0 && <p className="ui-meta">No live order right now.</p>}{live.map(row)}</section>
      <section className="ui-group" aria-label="Done"><h2>Done <span className="mono">{done.length}</span></h2>{done.length === 0 && <p className="ui-meta">Nothing done yet today.</p>}{done.map(row)}</section>
    </div>
  );
}
