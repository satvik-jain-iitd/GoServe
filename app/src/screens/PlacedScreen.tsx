// The customer's side after placing, to the Ink v3 boards 05, 06 and 07 (story H10c, #193; stories #48 and S-C): the slip with its stamp, the tracker, the delivery question and the cash line.
import { clock12 } from "../lib/clock";
import { formatRupees } from "../lib/money";
import { shortId, statusLabel, trackerSteps } from "../lib/kitchen";
import { etaView, type Eta } from "../lib/eta";
import type { OrderBill, PlacedOrder } from "../lib/orders";
import type { RiderCard } from "../lib/supabase";
import { useEffect, useState, type ReactNode } from "react";
import { PAY_WINDOW_S, PAY_METHODS, type PayMethod } from "../lib/payments";
import { devHelperOn } from "../lib/payGateway";
import { Timeline, TornTop } from "../ui";
import { AdjustLines } from "../ui/AdjustLines";
import { BackChevron } from "./BillScreen";
import { CancelSheet } from "./CancelSheet";
import { agoText, awayText, lastSeenText, metres, riderLink, type Point } from "../lib/riderMap";
import { useNowOnline } from "../lib/useNowOnline";
import type { LatLng } from "../lib/riderTrack";

type Props = {
  order: PlacedOrder;
  status: string;
  paidBy: string | null;
  bill?: OrderBill | null;   // story #1295: every amount the server took off has its own line, so the lines add up to the total
  confirmedAt: string | null;   // when the order closed, shown as the customer's local time
  early?: number | null;        // story 1508 (board DL1): minutes before the promised time; null on time, late or not known
  placedAt: string;             // when the order was made (ISO)
  lines: { name: string; qty: number; paise: number }[];
  kitchenName: string;
  headWait?: boolean;   // the kitchen's name is not known yet: the header line stays empty
  pin: string | null;
  kitchenPhone: string | null;
  address: string;
  error: string | null;         // the cancel line
  onMenu: () => void;           // Back to menu, with an empty cart (a delivered or cancelled order; story 1434)
  onBack: () => void;           // the chevron: back to the menu
  onCancel: () => void;         // story B3, #904: allowed while the order is placed or accepted
  cancelling: boolean;
  rider: RiderCard | null;      // story D2: shown once a rider has the order
  atDoor?: boolean;             // story #922: the rider tapped Arriving
  times?: Record<string, string>;   // story 1507 (board ST1): when each step happened (status to ISO time), from the order's own events; a step with no entry shows no time
  onCall?: () => void;          // story H14: the Call tap is counted ("where is my food" calls)
  pay?: Pay;                    // story #552: an online order waits for its payment
  track?: Track;                // story #691: On the way, with the rider's place known
  eta?: Eta | null;             // story #1015: the server's delivery time
  declined?: { reason: string; at: string } | null;   // story #934: the kitchen said no, in its own words
  again?: { block: ReactNode; bar: ReactNode };   // story 1589: a delivered order from History: the block under the slip and the one filled button, in place of Back to menu
};
export type Track = { you: LatLng | null; rider: Point; name: string; phone: string | null };   // story 1497: `you` is the order's own drop point; null when the order has none
export type Pay = {
  state: "ready" | "starting" | "waiting" | "failed" | "paid";
  method: PayMethod;
  startedAt: string | null;     // when the order was placed, for the 15 minute countdown (null after a refresh)
  error: string | null;
  onPay: () => void; onCash: () => void; onSimulate: () => void;
};

const placeholderGone = import.meta.env.VITE_PAYMENTS_PROVIDER === "razorpay";
// Story 1053 (boards T4, T5; before: #691 T2, T3): one rider row, no map in the page. A tap opens the full-screen map. The words refresh every 10 s; with no connection the row says when the rider was last seen.
const MAP_ICON = <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></svg>;
const GO = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>;
// Story 1498 (owner, 14 Nov 2026): the row looks as before; the tap opens Google Maps, the route from the rider to the order's pin.
function RiderRow({ t }: { t: Track }) {
  const { now, online } = useNowOnline();
  const away = t.you && awayText(metres(t.rider.lat, t.rider.lng, t.you.lat, t.you.lng));
  return (
    <a className="ui-locrow ui-riderrow" aria-label="See the rider on Google Maps" href={riderLink(t.rider, t.you)} target="_blank" rel="noopener noreferrer">
      <span className="ui-locrow-icon">{MAP_ICON}</span>
      <span className="ui-locrow-words">
        <span className="ui-locrow-title">{away ? `Rider is ${away} away` : <><b>{t.name}</b> is on the way</>}</span>
        <span className="ui-locrow-sub mono">{online ? `updated ${agoText(t.rider.at, now)}` : `No connection · ${lastSeenText(t.rider.at, now)}`}</span>
      </span>
      <span className="ui-locrow-go">{GO}</span>
    </a>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function Countdown({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!startedAt) return <p className="ui-wait">Waiting for payment</p>;
  return <p className="ui-wait">Waiting for payment · {mmss(Math.max(0, PAY_WINDOW_S - Math.floor((now - new Date(startedAt).getTime()) / 1000)))}</p>;
}

// The customer says it in his words: the kitchen's "Ready" is "Ready, rider picks up", the last step is "Delivered".
const STEP_WORDS: Record<string, string> = { ready: "Ready, rider picks up", delivered: "Delivered" };
const STAMP: Record<string, string> = { placed: "placed", accepted: "accepted", preparing: "cooking", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "cancelled" };

export function PlacedScreen({ order, status, paidBy, bill, confirmedAt, early, placedAt, lines, kitchenName, headWait, pin, kitchenPhone, address, error, onMenu, onBack, onCancel, cancelling, rider, onCall, pay, track, atDoor, times, declined, eta, again }: Props) {
  const riderPhone = (status === "out_for_delivery" ? track?.phone ?? rider?.phone : status === "ready" ? rider?.phone : null) || null;   // the track exists only on the way; the rider card is there from ready
  const [askCancel, setAskCancel] = useState(false);   // story #1227: the cancel sheet
  const steps = trackerSteps(status);
  const { now, online } = useNowOnline();
  const view = etaView(eta, now);
  const placed = new Date(placedAt);
  const delivered = status === "delivered";
  const cancelled = status === "cancelled";
  const title = status === "placed" ? "Order placed" : cancelled ? (declined ? "Declined" : "Cancelled") : "Your order";
  const head = headWait ? "" : [kitchenName, pin].filter(Boolean).join(" · ");
  return (
    <>
      <header className="ui-head">
        <BackChevron label="Back to menu" onClick={onBack} />
        <h1>{title}</h1>
        {!delivered && !cancelled && status !== "placed" ? online ? <span className="meta ui-livemark"><span aria-hidden="true" className="ui-live-dot" />Live</span> : <span className="meta">Offline</span> : <span className="meta">No. {shortId(order.id)}</span>}
      </header>
      <div className="ui-scroll">
        {!online && <p role="status" className="ui-offline">No connection. This page shows your last update and catches up when you are back online.</p>}   {/* bug #1228 */}
        {pay && status === "placed" && pay.state !== "paid" && (
          <div className="ui-paybox">
            {(pay.state === "ready" || pay.state === "starting") && (
              <button type="button" className="ui-btn bar" disabled={pay.state === "starting"} onClick={pay.onPay}>
                <span className="mono">{PAY_METHODS.find((m) => m.id === pay.method)?.label} · {formatRupees(order.total_paise)}</span><span className="verb">{pay.state === "starting" ? "Starting…" : "Pay now ›"}</span>
              </button>
            )}
            {pay.state === "waiting" && (
              <>
                <p role="status" className="ui-wait">Waiting for your payment</p>
                {!placeholderGone && <p className="ui-meta">Test payment: no money moves.</p>}
                {devHelperOn(import.meta.env) && <button type="button" className="ui-btn ghost" onClick={pay.onSimulate}>Simulate payment (test)</button>}
                <button type="button" className="ui-btn ghost" onClick={pay.onCash}>Pay cash instead</button>
              </>
            )}
            {pay.state === "failed" && (
              <>
                <p><strong>Nothing was charged.</strong></p>
                <button type="button" className="ui-btn" onClick={pay.onPay}>Try again</button>
                <button type="button" className="ui-btn ghost" onClick={pay.onCash}>Pay cash</button>
              </>
            )}
            {pay.error && <p role="alert" className="ui-field-error">{pay.error}</p>}
          </div>
        )}
        <section className="ui-slip ui-slip-pad" aria-label={delivered ? "Order, delivered" : "Order"}>
          <TornTop />
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>{head}</span><span>{delivered ? `${placed.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${clock12(placed)}` : `No. ${shortId(order.id)}`}</span></div>
            <div className="ui-slip-stamp"><span className={`ui-stamp ${STAMP[status] ?? "placed"}`}>{declined ? "Declined" : statusLabel(status)}</span></div>
            {pay && status === "placed" && (pay.state === "ready" || pay.state === "starting" || pay.state === "waiting") && <Countdown startedAt={pay.startedAt} />}
            {!cancelled && !delivered && view.kind === "time" && <><p className="display ui-eta-big">{view.min} min</p></>}
            {!cancelled && !delivered && view.kind === "late" && <p className="ui-clock ui-eta-late" role="status">Running late, sorry</p>}
            {!cancelled && !delivered && view.kind === "working" && <p className="ui-clock ui-eta-by">Working out the time</p>}
            {delivered && confirmedAt && <p className="ui-clock">At your door <b>{clock12(new Date(confirmedAt))}</b></p>}
            {delivered && confirmedAt && !!early && <p className="ui-clock ui-early">{early} min early</p>}   {/* story 1508 (board DL1): only when early; never "late" here */}
            <div className="ui-slip-rule" />
            <div className="ui-slip-lines">
              {lines.map((l) => <div key={l.name}><span>{l.qty} × {l.name}</span><span>{formatRupees(l.paise).replace("₹", "")}</span></div>)}
              {(bill?.fees?.delivery_paise ?? 0) === 0 && <div><span>Delivery</span><span>Free</span></div>}
              <AdjustLines bill={bill} plain />
            </div>
            <div className="ui-slip-rule" />
            <div className="ui-slip-total"><b>{declined || cancelled ? "Nothing to pay" : pay?.state === "paid" ? "Paid online" : pay ? "To pay online" : delivered && paidBy === "cash" ? "Cash paid" : delivered && paidBy === "upi_door" ? "Paid by UPI at the door" : delivered ? "Paid at the door" : "To pay at door"}</b><span>{declined || cancelled ? formatRupees(0) : formatRupees(order.total_paise)}</span></div>
          </div>
        </section>
        {again?.block}
        <div className="ui-after">
          {track && status === "out_for_delivery" && <RiderRow t={track} />}   {/* board T4: the row sits under the slip, above the timeline */}
          {!cancelled && <Timeline rows={3} steps={steps.map((x) => (atDoor && x.status === "out_for_delivery" ? "Rider at your door" : STEP_WORDS[x.status] ?? x.label))} current={steps.findIndex((x) => x.state === "current")} label="Order progress"
            right={steps.map((x) => (x.state === "current" && !delivered ? "Now" : x.state !== "todo" && times?.[x.status] ? clock12(new Date(times[x.status])) : null))} />}   {/* story 1324 (PL6, PL4, PL7): three rows, the delivered slip too */}
          {!delivered && !cancelled && address && <p className="mono ui-addr ph-no-capture">{address}</p>}
          {rider && !(track && status === "out_for_delivery") && (
            <div className="notice ui-ridercard" data-testid="rider-card">   {/* story 1657: one line, the name cut with dots, no button: the call is in the foot */}
              <strong>{(atDoor ? rider.name.split(" ")[0] : rider.name).trim() || "Your rider"}</strong>{" "}<span>{atDoor ? "is at your door." : "is bringing your order."}</span>
            </div>
          )}
          {declined ? (
            <>
              <div role="status" className="ui-declined">
                <p><strong>{kitchenName || "The kitchen"} could not take this order.</strong></p>
                <p>“{declined.reason}”</p>
                <p className="mono ui-declined-when">Declined {clock12(new Date(declined.at))} · {Math.max(0, Math.round((Date.parse(declined.at) - placed.getTime()) / 60_000))} min after you ordered</p>
              </div>
              <p className="ui-meta">{pay ? "Your money is not taken. If you paid online, it comes back in 5 to 7 days." : "Nothing was charged."}</p>   {/* story #1261: a pay-at-door order never talks about paying online */}
            </>
          ) : cancelled && <p role="status"><strong>Your order was cancelled. Nothing to pay.</strong></p>}
          {error && <p role="alert" className="ui-field-error">{error}</p>}
        </div>
      </div>
      {(status === "placed" || status === "accepted") && askCancel && <CancelSheet lines={lines} kitchenName={kitchenName || "the kitchen"} paidOnline={pay?.state === "paid"} onKeep={() => setAskCancel(false)} onYes={() => { setAskCancel(false); onCancel(); }} />}
      <div className="ui-bottom">   {/* story 1572: one button per line, full width, never side by side */}
        {(status === "placed" || status === "accepted") && <button type="button" className="ui-btn ghost big danger" disabled={cancelling} onClick={() => setAskCancel(true)}>Cancel order</button>}
        {riderPhone && <a href={`tel:${riderPhone}`} className="ui-btn ghost big" onClick={onCall}>Call the rider</a>}   {/* stories 1656, 1657: one call button by stage; the name is never in a button */}
        {!riderPhone && kitchenPhone && status !== "out_for_delivery" && <a href={`tel:${kitchenPhone}`} className="ui-btn ghost big">Call the kitchen</a>}
        {declined && <button type="button" className="ui-btn big" onClick={onMenu}>Order something else</button>}   {/* story 1458 (board T2b): the main button last, as on every end slip */}
        {again?.bar}
        {(cancelled || (delivered && !again)) && !declined && <button type="button" className="ui-btn big" onClick={onMenu}>Back to menu</button>}   {/* story 1434 (boards T1b, Delivered b): one name on both end slips, the main button last; the same dishes again only from History */}
      </div>
    </>
  );
}
