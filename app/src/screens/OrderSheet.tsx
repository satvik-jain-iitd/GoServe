// Story #934: a new order opens as a sheet (board K3-OrderSheet) with Accept and Decline; Decline opens a reason sheet (K3-OrderDecline).
import { useEffect, useRef, useState } from "react";
import { hhmm, isCash, shortId, type Order } from "../lib/kitchen";
import { formatRupees } from "../lib/money";
import { MIN_REASON } from "../lib/orders";
import { NoteBand, useSheetFit } from "../ui";
import { AdjustLines } from "../ui/AdjustLines";

const CHIPS: [string, string][] = [
  ["Out of an ingredient", "We are out of an ingredient tonight, so this dish cannot be made."],
  ["Too many orders right now", "We have too many orders right now and cannot take this one in time."],
  ["Closing early today", "We are closing early today and cannot take new orders."],
];

type Props = { order: Order; busy: boolean; error: string | null; onAccept: () => void; onDecline: (reason: string) => Promise<string | null>; onClose: () => void };

export function OrderSheet({ order, busy, error, onAccept, onDecline, onClose }: Props) {
  const fit = useSheetFit();
  const [deciding, setDeciding] = useState(false);
  const [reason, setReason] = useState("");
  const [declineError, setDeclineError] = useState<string | null>(null);
  const startY = useRef<number | null>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  const no = shortId(order.id);
  const cash = isCash(order);
  const first = order.customer_name?.trim().split(/\s+/)[0] || "the customer";
  const long = reason.trim().length >= MIN_REASON;
  const decline = async () => { if (long) setDeclineError(await onDecline(reason.trim())); };
  const swipe = (e: React.TouchEvent<HTMLElement>) => { if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 80 && e.currentTarget.scrollTop === 0) onClose(); startY.current = null; };
  return (
    <div ref={fit} className="ui-sheet-back" onClick={onClose}>
      {!deciding ? (
        <section className="ui-sheet ui-order-sheet" role="dialog" aria-modal="true" aria-label={`Order ${no}`} onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => { startY.current = e.touches[0].clientY; }} onTouchEnd={swipe}>
          <div className="ui-sheet-head"><h2>No. {no}</h2><span className="mono ui-sheet-when">Placed {hhmm(order.created_at)} · {cash ? "Cash" : "Online"}</span></div>
          <div className="ui-slip-lines ui-ticket-big">{order.items.map((i) => <div key={i.menu_item_id}><span>{i.qty} × {i.name}</span><span>{formatRupees(i.price_paise * i.qty)}</span></div>)}<AdjustLines bill={order.bill} /></div>
          <div className="ui-slip-rule" />
          {order.instructions?.trim() && <><NoteBand text={order.instructions.trim()} /><div className="ui-slip-rule" /></>}
          <div className="ui-sheet-block"><span className="mono ui-kicker">Deliver to</span><span>{order.address}</span></div>
          <div className="ui-slip-rule" />
          <div className="ui-slip-total"><b>{cash ? "Rider collects" : "Paid online"}</b><span>{formatRupees(order.total_paise)}</span></div>
          {error && <p role="alert" className="ui-note error">{error}</p>}
          <div className="ui-sheet-acts">
            <button type="button" className="ui-btn big" aria-label={`Accept ${no}`} disabled={busy} onClick={onAccept}>Accept</button>
            <button type="button" className="ui-btn ghost big ui-decline" onClick={() => setDeciding(true)}>Decline, with a reason</button>
          </div>
        </section>
      ) : (
        <section className="ui-sheet ui-order-sheet" role="dialog" aria-modal="true" aria-label={`Decline order ${no}`} onClick={(e) => e.stopPropagation()}>
          <div className="ui-sheet-head"><h2>Can&apos;t take No. {no}?</h2><span className="mono ui-sheet-when">{formatRupees(order.total_paise)} · {hhmm(order.created_at)}</span></div>
          <p className="ui-sheet-lead">Tell {first} why. They read these exact words on their phone, so write a full sentence.</p>
          <label htmlFor="decline-why" className="mono ui-kicker">Reason</label>
          <textarea id="decline-why" className="ui-sheet-text" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="mono ui-sheet-count"><span>{reason.trim().length} characters</span><span>at least {MIN_REASON}</span></p>
          <div className="ui-sheet-chips">{CHIPS.map(([label, sentence]) => <button key={label} type="button" className="ui-chip" onClick={() => setReason(sentence)}>{label}</button>)}</div>
          {declineError && <p role="alert" className="ui-note error">{declineError}</p>}
          <div className="ui-sheet-acts">
            <button type="button" className="ui-btn big danger-fill" disabled={!long || busy} aria-disabled={!long || busy} onClick={() => void decline()}>Decline this order</button>
            <button type="button" className="ui-btn ghost big" onClick={() => setDeciding(false)}>Back to the order</button>
          </div>
          <p className="mono ui-sheet-foot">Under {MIN_REASON} characters the red button stays asleep</p>
        </section>
      )}
    </div>
  );
}
