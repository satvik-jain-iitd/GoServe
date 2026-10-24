// The customer's side after placing, to the Ink v3 boards 05, 06 and 07 (story H10c, #193; stories #48 and S-C): the slip with its stamp, the tracker, the delivery question and the cash line.
import { formatRupees } from "../lib/money";
import { shortId, statusLabel, trackerSteps } from "../lib/kitchen";
import { etaMinutes } from "../lib/profile";
import type { PlacedOrder } from "../lib/orders";
import type { RiderCard } from "../lib/supabase";
import { Timeline } from "../ui";
import { BackChevron } from "./BillScreen";

type Props = {
  order: PlacedOrder;
  status: string;
  paidBy: string | null;
  confirmedAt: string | null;   // when the order closed, shown as the customer's local time
  placedAt: string;             // when the order was made (ISO)
  lines: { name: string; qty: number; paise: number }[];
  kitchenName: string;
  pin: string | null;
  kitchenPhone: string | null;
  address: string;
  asking: boolean;              // show "Was your order delivered?"
  busy: boolean;
  error: string | null;
  reminder: "ask" | "on" | "none";
  onYes: () => void;
  onNotYet: () => void;
  onAllowReminder: () => void;
  onAgain: () => void;          // Order again (a delivered or cancelled order)
  onBack: () => void;           // the chevron: back to the menu
  onCancel: () => void;         // story B3: allowed only while the order is placed
  cancelling: boolean;
  rider: RiderCard | null;      // story D2: shown once a rider has the order
  onCall?: () => void;          // story H14: the Call tap is counted ("where is my food" calls)
};

const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
// The customer says it in his words: the kitchen's "Ready" is "Ready, rider picks up", the last step is "At your door".
const STEP_WORDS: Record<string, string> = { ready: "Ready, rider picks up", delivered: "At your door" };
const STAMP: Record<string, string> = { placed: "placed", accepted: "accepted", preparing: "cooking", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "error" };

export function PlacedScreen({ order, status, paidBy, confirmedAt, placedAt, lines, kitchenName, pin, kitchenPhone, address, asking, busy, error, reminder, onYes, onNotYet, onAllowReminder, onAgain, onBack, onCancel, cancelling, rider, onCall }: Props) {
  const steps = trackerSteps(status);
  const eta = etaMinutes();
  const placed = new Date(placedAt);
  const door = new Date(placed.getTime() + eta * 60_000);
  const delivered = status === "delivered";
  const cancelled = status === "cancelled";
  const title = status === "placed" ? "Order placed" : delivered ? "Delivered" : cancelled ? "Cancelled" : "Your order";
  const head = [kitchenName, pin].filter(Boolean).join(" · ");
  return (
    <>
      <header className="ui-head">
        <BackChevron label="Back to the menu" onClick={onBack} />
        <h1>{title}</h1>
        {!delivered && !cancelled && status !== "placed" ? <span className="meta ui-livemark"><span aria-hidden="true" className="ui-live-dot" />Live</span> : <span className="meta">No. {shortId(order.id)}</span>}
      </header>
      <div className="ui-scroll">
        <section className="ui-slip ui-slip-pad" aria-label={delivered ? "Order, delivered" : "Order"}>
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>{head}</span><span>{delivered ? `${placed.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${hhmm(placed)}` : `No. ${shortId(order.id)}`}</span></div>
            <div className="ui-slip-stamp"><span className={`ui-stamp ${STAMP[status] ?? "placed"}`}>{statusLabel(status)}</span></div>
            {!cancelled && !delivered && <p className="ui-clock">About <b>{eta} min</b> · door by {hhmm(door)}</p>}
            {delivered && confirmedAt && <p className="ui-clock">At your door <b>{hhmm(new Date(confirmedAt))}</b></p>}
            <div className="ui-slip-rule" />
            <div className="ui-slip-lines">
              {lines.map((l) => <div key={l.name}><span>{l.qty} × {l.name}</span><span>{formatRupees(l.paise).replace("₹", "")}</span></div>)}
              <div><span>Delivery</span><span>Free</span></div>
            </div>
            <div className="ui-slip-rule" />
            <div className="ui-slip-total"><b>{delivered && paidBy === "cash" ? "Cash paid" : "Cash at door"}</b><span>{formatRupees(order.total_paise)}</span></div>
          </div>
        </section>
        <div className="ui-after">
          {status === "placed" && <p>The kitchen sees your order now. The slip gets stamped when it is accepted.</p>}
          {!delivered && !cancelled && <Timeline steps={steps.map((x) => STEP_WORDS[x.status] ?? x.label)} current={steps.findIndex((x) => x.state === "current")} label="Order progress" />}
          {!delivered && !cancelled && address && <p className="mono ui-addr">{address}</p>}
          {rider && (
            <div className="notice" data-testid="rider-card">
              <strong>{rider.name}</strong> is bringing your order.{" "}
              <a className="ui-btn" href={`tel:${rider.phone}`} onClick={onCall}>Call {rider.name}</a>
            </div>
          )}
          {cancelled && <p role="status"><strong>Your order was cancelled.</strong></p>}
          {status === "ready" && !asking && <p role="status">Tap Yes when you have it</p>}
          {asking && (
            <div role="group" aria-label="Delivery check" className="ui-closed ui-ask">
              <h3>Was your order delivered?</h3>
              <div className="ui-ask-act">
                <button type="button" className="ui-btn" disabled={busy} onClick={onYes}>Yes, I have it</button>
                <button type="button" className="ui-btn ghost" disabled={busy} onClick={onNotYet}>Not yet</button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="ui-field-error">{error}</p>}
          {delivered && (
            <>
              <p>Delivered. Thank you for eating with GoServe.{paidBy === "cash" && confirmedAt ? <> Paid: cash · confirmed {clock(confirmedAt)}</> : null}</p>
              <p className="ui-note">Something wrong with the food or the change? Call the kitchen.</p>
            </>
          )}
          {reminder === "ask" && !delivered && !cancelled && (
            <button type="button" className="ui-btn ghost" onClick={onAllowReminder}>Allow a reminder when your order is ready?</button>
          )}
        </div>
      </div>
      <div className="ui-bottom">
        {(delivered || cancelled) && <button type="button" className="ui-btn big" onClick={onAgain}>Order again</button>}
        {status === "placed" && <button type="button" className="ui-btn ghost big" disabled={cancelling} onClick={onCancel}>Cancel order</button>}
        {kitchenPhone && <a href={`tel:${kitchenPhone}`} className="ui-btn ghost big">Call the kitchen</a>}
      </div>
    </>
  );
}
