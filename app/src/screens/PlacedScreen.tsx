// The customer's side after placing, to the Ink v3 boards 05, 06 and 07 (story H10c, #193; stories #48 and S-C): the slip with its stamp, the tracker, the delivery question and the cash line.
import { clock12 } from "../lib/clock";
import { formatRupees } from "../lib/money";
import { shortId, statusLabel, trackerSteps } from "../lib/kitchen";
import { etaView, type Eta } from "../lib/eta";
import type { PlacedOrder } from "../lib/orders";
import type { RiderCard } from "../lib/supabase";
import { useEffect, useState } from "react";
import { PAY_WINDOW_S, PAY_METHODS, type PayMethod } from "../lib/payments";
import { devHelperOn } from "../lib/payGateway";
import { Timeline } from "../ui";
import { BackChevron } from "./BillScreen";
import { RiderMapScreen } from "./RiderMapScreen";
import { agoText, distanceText, lastSeenText, type Point } from "../lib/riderMap";
import { useNowOnline } from "../lib/useNowOnline";
import type { LatLng } from "../lib/riderTrack";

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
  reminder: "ask" | "on" | "off" | "none";
  onYes: () => void;
  onNotYet: () => void;
  onAllowReminder: () => void;
  onMenu: () => void;           // See the menu, with an empty cart (a delivered or cancelled order)
  onAgain: () => void;          // the cancelled order's button: the bill with the same dishes (bug #1229)
  onBack: () => void;           // the chevron: back to the menu
  onCancel: () => void;         // story B3, #904: allowed while the order is placed or accepted
  cancelling: boolean;
  rider: RiderCard | null;      // story D2: shown once a rider has the order
  atDoor?: boolean;             // story #922: the rider tapped Arriving
  onCall?: () => void;          // story H14: the Call tap is counted ("where is my food" calls)
  pay?: Pay;                    // story #552: an online order waits for its payment
  track?: Track;                // story #691: On the way, with the rider's place known
  eta?: Eta | null;             // story #1015: the server's delivery time
  declined?: { reason: string; at: string } | null;   // story #934: the kitchen said no, in its own words
};
export type Track = { kitchen: LatLng; you: LatLng; rider: Point; name: string; phone: string | null };
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
function RiderRow({ t, onOpen }: { t: Track; onOpen: () => void }) {
  const { now, online } = useNowOnline();
  return (
    <button type="button" className="ui-locrow ui-riderrow" aria-label="See the rider on the map" onClick={onOpen}>
      <span className="ui-locrow-icon">{MAP_ICON}</span>
      <span className="ui-locrow-words">
        <span className="ui-locrow-title"><b>{t.name}</b> is {distanceText(t.rider.lat, t.rider.lng, t.you.lat, t.you.lng)} away</span>
        <span className="ui-locrow-sub mono">{online ? `On the map · updated ${agoText(t.rider.at, now)}` : `No connection · ${lastSeenText(t.rider.at, now)}`}</span>
      </span>
      <span className="ui-locrow-go">{GO}</span>
    </button>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function Countdown({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!startedAt) return <p className="ui-wait">Waiting for payment</p>;
  return <p className="ui-wait">Waiting for payment · {mmss(Math.max(0, PAY_WINDOW_S - Math.floor((now - new Date(startedAt).getTime()) / 1000)))}</p>;
}

// The customer says it in his words: the kitchen's "Ready" is "Ready, rider picks up", the last step is "At your door".
const STEP_WORDS: Record<string, string> = { ready: "Ready, rider picks up", delivered: "At your door" };
const STAMP: Record<string, string> = { placed: "placed", accepted: "accepted", preparing: "cooking", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "cancelled" };

export function PlacedScreen({ order, status, paidBy, confirmedAt, placedAt, lines, kitchenName, pin, kitchenPhone, address, asking, busy, error, reminder, onYes, onNotYet, onAllowReminder, onMenu, onAgain, onBack, onCancel, cancelling, rider, onCall, pay, track, atDoor, declined, eta }: Props) {
  const [mapOpen, setMapOpen] = useState(false);   // story 1053: the full-screen rider map
  const steps = trackerSteps(status);
  const { now, online } = useNowOnline();
  const view = etaView(eta, now);
  const placed = new Date(placedAt);
  const door = view.kind === "time" ? clock12(view.by) : null;   // the clock the server's estimate lands on
  const delivered = status === "delivered";
  const cancelled = status === "cancelled";
  const title = status === "placed" ? "Order placed" : delivered ? "Delivered" : cancelled ? (declined ? "Declined" : "Cancelled") : "Your order";
  const head = [kitchenName, pin].filter(Boolean).join(" · ");
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
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>{head}</span><span>{delivered ? `${placed.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${clock12(placed)}` : `No. ${shortId(order.id)}`}</span></div>
            <div className="ui-slip-stamp"><span className={`ui-stamp ${STAMP[status] ?? "placed"}`}>{declined ? "Declined" : statusLabel(status)}</span></div>
            {pay && status === "placed" && (pay.state === "ready" || pay.state === "starting" || pay.state === "waiting") && <Countdown startedAt={pay.startedAt} />}
            {!cancelled && !delivered && view.kind === "time" && <><p className="display ui-eta-big">{view.min} min</p><p className="ui-clock ui-eta-by">By {clock12(view.by)}</p></>}
            {!cancelled && !delivered && view.kind === "late" && <p className="ui-clock ui-eta-late" role="status">Running late, sorry</p>}
            {!cancelled && !delivered && view.kind === "working" && <p className="ui-clock ui-eta-by">Working out the time</p>}
            {delivered && confirmedAt && <p className="ui-clock">At your door <b>{clock12(new Date(confirmedAt))}</b></p>}
            <div className="ui-slip-rule" />
            <div className="ui-slip-lines">
              {lines.map((l) => <div key={l.name}><span>{l.qty} × {l.name}</span><span>{formatRupees(l.paise).replace("₹", "")}</span></div>)}
              <div><span>Delivery</span><span>Free</span></div>
            </div>
            <div className="ui-slip-rule" />
            <div className="ui-slip-total"><b>{declined || cancelled ? "Nothing to pay" : pay?.state === "paid" ? "Paid online" : pay ? "To pay online" : delivered && paidBy === "cash" ? "Cash paid" : delivered && paidBy === "upi_door" ? "Paid by UPI at the door" : "To pay at door"}</b><span>{declined || cancelled ? formatRupees(0) : formatRupees(order.total_paise)}</span></div>
          </div>
        </section>
        <div className="ui-after">
          {status === "placed" && <p>The kitchen has your order. This page updates on its own.</p>}
          {track && status === "out_for_delivery" && <RiderRow t={track} onOpen={() => setMapOpen(true)} />}   {/* board T4: the row sits under the slip, above the timeline */}
          {!delivered && !cancelled && <Timeline steps={steps.map((x) => (atDoor && x.status === "out_for_delivery" ? "Rider at your door" : STEP_WORDS[x.status] ?? x.label))} current={steps.findIndex((x) => x.state === "current")} label="Order progress" />}
          {!delivered && !cancelled && address && <p className="mono ui-addr ph-no-capture">{address}</p>}
          {rider && !(track && status === "out_for_delivery") && (
            <div className="notice" data-testid="rider-card">
              <strong>{atDoor ? rider.name.split(" ")[0] : rider.name}</strong> {atDoor ? "is at your door." : "is bringing your order."}{" "}
              <a className="ui-btn" href={`tel:${rider.phone}`} onClick={onCall}>Call {rider.name}</a>
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
              <p>Delivered. Thank you for eating with GoServe.</p>
            </>
          )}
          {reminder === "ask" && !delivered && !cancelled && (
            <button type="button" className="ui-btn ghost" onClick={onAllowReminder}>Ping me when it is ready</button>
          )}
        </div>
      </div>
      {mapOpen && track && status === "out_for_delivery" && <RiderMapScreen t={track} orderNo={shortId(order.id)} door={door} onBack={() => setMapOpen(false)} onCall={onCall} />}
      <div className="ui-bottom">
        {(delivered || cancelled) && <button type="button" className="ui-btn big" onClick={cancelled && !declined ? onAgain : onMenu}>{declined ? "Order something else" : cancelled ? "Order again" : "See the menu"}</button>}
        {(status === "placed" || status === "accepted") && <button type="button" className="ui-btn ghost big" disabled={cancelling} onClick={onCancel}>Cancel order</button>}
        {track?.phone && status === "out_for_delivery" && <a href={`tel:${track.phone}`} className="ui-btn ghost big" onClick={onCall}>Call the rider</a>}
        {kitchenPhone && <a href={`tel:${kitchenPhone}`} className="ui-btn ghost big">Call the kitchen</a>}
      </div>
    </>
  );
}
