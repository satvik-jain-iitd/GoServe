// The customer's side after placing, to the Ink v3 boards 05, 06 and 07 (story H10c, #193; stories #48 and S-C): the slip with its stamp, the tracker, the delivery question and the cash line.
import { clock12 } from "../lib/clock";
import { formatRupees } from "../lib/money";
import { shortId, statusLabel, trackerSteps } from "../lib/kitchen";
import { etaMinutes } from "../lib/profile";
import type { PlacedOrder } from "../lib/orders";
import type { RiderCard } from "../lib/supabase";
import { useEffect, useState } from "react";
import { PAY_WINDOW_S, PAY_METHODS, type PayMethod } from "../lib/payments";
import { devHelperOn } from "../lib/payGateway";
import { Timeline } from "../ui";
import { BackChevron } from "./BillScreen";
import { RiderMap } from "./RiderMap";
import { distanceText, lastSeenText, riderLine, type Point } from "../lib/riderMap";
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
  onBack: () => void;           // the chevron: back to the menu
  onCancel: () => void;         // story B3: allowed only while the order is placed
  cancelling: boolean;
  rider: RiderCard | null;      // story D2: shown once a rider has the order
  onCall?: () => void;          // story H14: the Call tap is counted ("where is my food" calls)
  pay?: Pay;                    // story #552: an online order waits for its payment
  track?: Track;                // story #691: On the way, with the rider's place known
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
// Story #691 (boards T2, T3): the map card. The words refresh every 10 s; a phone with no connection greys the map and says when the rider was last seen.
function MapCard({ t }: { t: Track }) {
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    const up = () => { setOnline(true); setNow(Date.now()); }, down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { clearInterval(tick); window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  const last = lastSeenText(t.rider.at, now);
  return (
    <section className="ui-mapcard" aria-label="Rider on the map">
      <RiderMap kitchen={t.kitchen} you={t.you} rider={t.rider} offline={!online} />
      {online
        ? <div className="ui-map-line"><span aria-hidden="true" className="ui-live-dot" /><span><b>{t.name}</b>{riderLine("", distanceText(t.rider.lat, t.rider.lng, t.you.lat, t.you.lng), t.rider.at, now)}</span></div>
        : <div className="ui-map-line offline"><span className="ui-chip-warn">No connection</span><span><b>{last.slice(0, last.indexOf(","))}</b>{last.slice(last.indexOf(","))}</span></div>}
    </section>
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
const STAMP: Record<string, string> = { placed: "placed", accepted: "accepted", preparing: "cooking", ready: "ready", out_for_delivery: "out", delivered: "delivered", cancelled: "error" };

export function PlacedScreen({ order, status, paidBy, confirmedAt, placedAt, lines, kitchenName, pin, kitchenPhone, address, asking, busy, error, reminder, onYes, onNotYet, onAllowReminder, onMenu, onBack, onCancel, cancelling, rider, onCall, pay, track }: Props) {
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
        <BackChevron label="Back to menu" onClick={onBack} />
        <h1>{title}</h1>
        {!delivered && !cancelled && status !== "placed" ? <span className="meta ui-livemark"><span aria-hidden="true" className="ui-live-dot" />Live</span> : <span className="meta">No. {shortId(order.id)}</span>}
      </header>
      <div className="ui-scroll">
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
            <div className="ui-slip-stamp"><span className={`ui-stamp ${STAMP[status] ?? "placed"}`}>{statusLabel(status)}</span></div>
            {pay && status === "placed" && (pay.state === "ready" || pay.state === "starting" || pay.state === "waiting") && <Countdown startedAt={pay.startedAt} />}
            {!cancelled && !delivered && <p className="ui-clock">About <b>{eta} min</b> · at your door by {clock12(door)}</p>}
            {delivered && confirmedAt && <p className="ui-clock">At your door <b>{clock12(new Date(confirmedAt))}</b></p>}
            <div className="ui-slip-rule" />
            <div className="ui-slip-lines">
              {lines.map((l) => <div key={l.name}><span>{l.qty} × {l.name}</span><span>{formatRupees(l.paise).replace("₹", "")}</span></div>)}
              <div><span>Delivery</span><span>Free</span></div>
            </div>
            <div className="ui-slip-rule" />
            <div className="ui-slip-total"><b>{pay?.state === "paid" ? "Paid online" : pay ? "To pay online" : delivered && paidBy === "cash" ? "Cash paid" : "Cash at door"}</b><span>{formatRupees(order.total_paise)}</span></div>
          </div>
        </section>
        <div className="ui-after">
          {status === "placed" && <p>The kitchen has your order. This page updates on its own.</p>}
          {!delivered && !cancelled && <Timeline steps={steps.map((x) => STEP_WORDS[x.status] ?? x.label)} current={steps.findIndex((x) => x.state === "current")} label="Order progress" />}
          {!delivered && !cancelled && address && <p className="mono ui-addr ph-no-capture">{address}</p>}
          {track && status === "out_for_delivery" && <MapCard t={track} />}
          {rider && !(track && status === "out_for_delivery") && (
            <div className="notice" data-testid="rider-card">
              <strong>{rider.name}</strong> is bringing your order.{" "}
              <a className="ui-btn" href={`tel:${rider.phone}`} onClick={onCall}>Call {rider.name}</a>
            </div>
          )}
          {cancelled && <p role="status"><strong>Your order was cancelled. Nothing to pay.</strong></p>}
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
      <div className="ui-bottom">
        {(delivered || cancelled) && <button type="button" className="ui-btn big" onClick={onMenu}>{cancelled ? "Order again" : "See the menu"}</button>}
        {status === "placed" && <button type="button" className="ui-btn ghost big" disabled={cancelling} onClick={onCancel}>Cancel order</button>}
        {track?.phone && status === "out_for_delivery" && <a href={`tel:${track.phone}`} className="ui-btn ghost big" onClick={onCall}>Call the rider</a>}
        {kitchenPhone && <a href={`tel:${kitchenPhone}`} className="ui-btn ghost big">Call the kitchen</a>}
      </div>
    </>
  );
}
