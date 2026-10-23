import type { PlacedOrder } from "../lib/orders";
import { formatRupees } from "../lib/money";
import { shortId, trackerSteps } from "../lib/kitchen";
import { etaMinutes } from "../lib/profile";

// The customer's side after placing (stories #48 and S-C): the tracker, the delivery question, and the cash line.
type Props = {
  order: PlacedOrder;
  status: string;
  paidBy: string | null;
  confirmedAt: string | null;   // when the order closed, shown as the customer's local time
  asking: boolean;              // show "Was your order delivered?"
  busy: boolean;
  error: string | null;
  reminder: "ask" | "on" | "none";
  onYes: () => void;
  onNotYet: () => void;
  onAllowReminder: () => void;
  onAgain: () => void;
  onCancel: () => void;         // story B3: allowed only while the order is placed
  cancelling: boolean;
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();

export function PlacedScreen({ order, status, paidBy, confirmedAt, asking, busy, error, reminder, onYes, onNotYet, onAllowReminder, onAgain, onCancel, cancelling }: Props) {
  return (
    <section>
      <h2>Order placed</h2>
      <p>Your order number is <strong>{shortId(order.id)}</strong>.</p>
      <p>Total to pay on delivery: {formatRupees(order.total_paise)}</p>
      <p className="note">{status === "cancelled" ? "Cash on delivery" : `About ${etaMinutes()} min · cash on delivery`}</p>
      <ol className="tracker" aria-label="Order progress">
        {trackerSteps(status).map((s) => (
          <li key={s.status} className={`step ${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>{s.label}</li>
        ))}
      </ol>
      {status === "cancelled" && <p role="status"><strong>Your order was cancelled.</strong></p>}
      {status === "placed" && <button type="button" className="btn ghost" disabled={cancelling} onClick={onCancel}>Cancel order</button>}
      {status === "ready" && !asking && <p role="status">Tap Yes when you have it</p>}
      {asking && (
        <div role="group" aria-label="Delivery check" className="notice">
          <h3>Was your order delivered?</h3>
          <div className="demobar">
            <button type="button" className="btn" disabled={busy} onClick={onYes}>Yes, I have it</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={onNotYet}>Not yet</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      {reminder === "ask" && status !== "delivered" && status !== "cancelled" && (
        <button type="button" className="btn small ghost" onClick={onAllowReminder}>Allow a reminder when your order is ready?</button>
      )}
      {status === "delivered" && (
        <p><strong>Your order has been delivered.</strong>{paidBy === "cash" && confirmedAt ? <> Paid: cash · confirmed {clock(confirmedAt)}</> : null}</p>
      )}
      <button type="button" className="btn" onClick={onAgain}>Order more</button>
    </section>
  );
}
