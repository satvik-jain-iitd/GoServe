import type { PlacedOrder } from "../lib/orders";
import { formatRupees } from "../lib/money";
import { trackerSteps } from "../lib/kitchen";
import type { RiderCard } from "../lib/supabase";
import { Button, Timeline } from "../ui";
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
  rider: RiderCard | null;      // story D2: shown once a rider has the order
  onCall?: () => void;          // story H14: the Call tap is counted ("where is my food" calls)
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();

export function PlacedScreen({ order, status, paidBy, confirmedAt, asking, busy, error, reminder, onYes, onNotYet, onAllowReminder, onAgain, onCancel, cancelling, rider, onCall }: Props) {
  const steps = trackerSteps(status);
  return (
    <section>
      <h2>Order placed</h2>
      <p>Total to pay on delivery: {formatRupees(order.total_paise)}</p>
      <p className="note">{status === "cancelled" ? "Cash on delivery" : `About ${etaMinutes()} min · cash on delivery`}</p>
      <Timeline steps={steps.map((x) => x.label)} current={steps.findIndex((x) => x.state === "current")} label="Order progress" />
      {rider && (
        <div className="notice" data-testid="rider-card">
          <strong>{rider.name}</strong> is bringing your order.{" "}
          <a className="ui-btn" href={`tel:${rider.phone}`} onClick={onCall}>Call {rider.name}</a>
        </div>
      )}
      {status === "cancelled" && <p role="status"><strong>Your order was cancelled.</strong></p>}
      {status === "placed" && <Button variant="ghost" disabled={cancelling} onClick={onCancel}>Cancel order</Button>}
      {status === "ready" && !asking && <p role="status">Tap Yes when you have it</p>}
      {asking && (
        <div role="group" aria-label="Delivery check" className="notice">
          <h3>Was your order delivered?</h3>
          <div className="demobar">
            <Button disabled={busy} onClick={onYes}>Yes, I have it</Button>
            <Button variant="ghost" disabled={busy} onClick={onNotYet}>Not yet</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      {reminder === "ask" && status !== "delivered" && status !== "cancelled" && (
        <Button variant="ghost" onClick={onAllowReminder}>Allow a reminder when your order is ready?</Button>
      )}
      {status === "delivered" && (
        <p><strong>Your order has been delivered.</strong>{paidBy === "cash" && confirmedAt ? <> Paid: cash · confirmed {clock(confirmedAt)}</> : null}</p>
      )}
      <Button onClick={onAgain}>Order more</Button>
    </section>
  );
}
