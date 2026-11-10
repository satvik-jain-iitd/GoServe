// The rider app on the Ink v3 boards R3 to R9 (story H11, #194): one delivery in hand (Job), today's cash (Today), and Me.
import { useState } from "react";
import { deliveredToday, hhmm, riderActions, riderOrders, shortId, type Order, type RiderAction } from "../lib/kitchen";
import { formatRupees } from "../lib/money";
import { cashInHand, firstName, handedOver, hoursOf, locationLabel, type KitchenCard, type RiderGateState } from "../lib/rider";
import type { DoorMethod } from "../lib/doorMethods";
import { Skeleton, Tabs } from "../ui";

type Tab = "job" | "today" | "me";
type Props = {
  orders: Order[]; loading: boolean; error: string | null; busyId: string | null; arrived: Set<string>;
  onAct: (order: Order, action: RiderAction, method?: DoorMethod) => Promise<{ code: string; message: string } | null>;
  methods: DoorMethod[] | null;   // story 1262: the ways to collect that are on; null while the read is on its way, [] when it failed
  qrUrl: string | null | undefined;   // story 1263: the QR the admin uploaded; null when none is set or the read failed; undefined while the read is on its way
  onLoadMethods: () => void;
  gate: RiderGateState | null;   // null in the demo console: no online switch, no sign out
  kitchen: KitchenCard | null;   // the kitchen of the delivery in hand
};
const TABS: { key: Tab; label: string; icon: Tab }[] = [{ key: "job", label: "Delivery", icon: "job" }, { key: "today", label: "Today", icon: "today" }, { key: "me", label: "Me", icon: "me" }];

export function RiderScreen({ orders, loading, error, busyId, arrived, onAct, methods: methodsRead, qrUrl, onLoadMethods, gate, kitchen }: Props) {
  const methods = qrUrl === undefined ? null : methodsRead;   // the screen names nothing until both answers are in
  const [tab, setTab] = useState<Tab>("job");
  const [doneId, setDoneId] = useState<string | null>(null);   // the slip just delivered stays until "Next delivery" (R7)
  const jobs = riderOrders(orders);
  const job = jobs[0] ?? null;
  const done = doneId ? orders.find((o) => o.id === doneId) ?? null : null;
  const today = deliveredToday(orders, new Date(), hoursOf(kitchen));   // story #229: the day ends at the kitchen's closing time
  const cash = cashInHand(today);
  const handed = handedOver(today);
  const paidLabel = (p: string | null | undefined) => (p === "upi_door" ? "Paid by UPI" : p === "cash" ? "Cash collected" : "Collected");   // never guess cash: an empty paid_by is just Collected
  const [brokenQr, setBrokenQr] = useState<string | null>(null);
  const [collectId, setCollectId] = useState<string | null>(null);   // story 1262, board R7: "Delivered" opens Collect payment first
  const act = async (o: Order, a: RiderAction, method?: DoorMethod) => {
    const failed = await onAct(o, a, method);
    if (!failed && a.kind === "status" && a.to === "delivered") { setCollectId(null); setDoneId(o.id); }
  };
  const openCollect = (o: Order) => { setCollectId(o.id); onLoadMethods(); };
  const button = (o: Order, a: RiderAction, text: string, ghost = false) => (
    <button key={a.label} type="button" className={ghost ? "ui-btn ghost big" : "ui-btn big"} aria-label={`${a.label} ${shortId(o.id)}`}
      disabled={busyId === o.id || (a.kind === "event" && arrived.has(o.id))} onClick={() => void act(o, a)}>{text}</button>
  );
  const deliverTo = (o: Order) => (
    <div className="ui-deliver">
      <span className="mono ui-kicker">Deliver to</span>
      <b>{o.customer_name || "The customer"}</b>
      <span>{o.address}</span>
    </div>
  );
  const callRow = (o: Order) => o.customer_phone ? (
    <a className="ui-row ui-call" href={`tel:${o.customer_phone}`}>
      <span className="ui-call-name"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>Call {firstName(o.customer_name)}</span>
      <span className="mono ui-call-no">{o.customer_phone}</span>
    </a>
  ) : null;
  const todayLine = <p className="mono ui-foot">Today · {today.length} delivered</p>;

  const jobView = () => {
    if (loading && orders.length === 0) return <div className="ui-pad"><Skeleton lines={3} /></div>;
    const collecting = collectId ? jobs.find((o) => o.id === collectId) ?? null : null;
    if (collecting && !done) {   // R7 Collect payment: the rider says how it was paid, and that marks the order delivered
      const deliver = riderActions(collecting.status).find((a) => a.kind === "status" && a.to === "delivered");
      const amount = formatRupees(collecting.total_paise);
      const busy = busyId === collecting.id;
      const qrShown = qrUrl && brokenQr !== qrUrl ? qrUrl : null;   // a picture that will not load counts as no QR
      const upiOn = methods?.includes("upi_door") ?? false;
      const upi = upiOn && qrShown !== null;   // no QR to show: no UPI button either
      const upiNeedsQr = upiOn && qrShown === null;
      const cash = methods?.includes("cash") ?? false;
      return (
        <>
          <section className="ui-slip ui-slip-pad" aria-label={`Collect payment ${shortId(collecting.id)}`}>
            <div className="ui-slip-body">
              <div className="ui-slip-head"><span>Collect payment</span><span>{collecting.customer_name || "The customer"}</span></div>
              <div className="ui-slip-total"><b>To collect</b><span data-testid="collect-total">{amount}</span></div>
              {methods === null && <p className="ui-meta" role="status" aria-live="polite">Checking how this customer can pay…</p>}
              {methods !== null && methods.length === 0 && <p className="ui-meta">We could not check how to collect. Try again.</p>}
              {upi && (
                <div className="ui-qr">
                  <img src={qrShown!} width={200} height={200} alt="UPI QR to scan" onError={() => setBrokenQr(qrUrl ?? null)} />
                </div>
              )}
              {upi && <p className="ui-meta">Wait for the customer's paid screen. Then tap below.</p>}
              {upiNeedsQr && <p className="ui-meta">UPI at the door has no QR yet. Take cash, or ask the admin to upload the QR.</p>}
            </div>
          </section>
          <div className="ui-bottom">
            {methods !== null && methods.length === 0 && <button type="button" className="ui-btn big" onClick={onLoadMethods}>Try again</button>}
            {deliver && cash && <button type="button" className={upi ? "ui-btn ghost big" : "ui-btn big"} disabled={busy} onClick={() => void act(collecting, deliver, "cash")}>Took cash {amount}</button>}
            {deliver && upi && <button type="button" className="ui-btn big" disabled={busy} onClick={() => void act(collecting, deliver, "upi_door")}>Paid by UPI {amount}</button>}
            <button type="button" className="ui-btn text" disabled={busy} onClick={() => setCollectId(null)}>Back</button>
          </div>
        </>
      );
    }
    if (done) return (   // R7
      <>
        <section className="ui-slip ui-slip-pad" aria-label={`Order ${shortId(done.id)}`}>
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>{kitchen?.name ?? "Delivered"}</span><span>{done.customer_name || "Customer"}</span></div>
            <div className="ui-slip-stamp"><span className="ui-stamp delivered">Delivered</span></div>
            <p className="ui-clock">At the door <b>{hhmm(done.updated_at)}</b></p>
            <div className="ui-slip-rule" />
            <div className="ui-slip-total"><b>{paidLabel(done.paid_by)}</b><span>{formatRupees(done.total_paise)}</span></div>
          </div>
        </section>
        {todayLine}
        <div className="ui-bottom"><button type="button" className="ui-btn big" onClick={() => setDoneId(null)}>Next delivery</button></div>
      </>
    );
    if (job) {   // R5 and R6
      const out = job.status === "out_for_delivery";
      const [first, ...rest] = riderActions(job.status);
      return (
        <>
          <section className="ui-slip ui-slip-pad" aria-label={`Order ${shortId(job.id)}`}>
            <div className="ui-slip-body">
              {out ? (
                <>
                  <div className="ui-slip-head"><span>{kitchen?.name ?? "Picked up"}</span><span>Picked up {hhmm(job.updated_at)}</span></div>
                  <div className="ui-slip-stamp"><span className="ui-stamp out">On the way</span></div>
                  {deliverTo(job)}
                </>
              ) : (
                <>
                  <div className="ui-slip-head"><span>Pick up at</span><span>Ready</span></div>
                  <div className="ui-deliver"><b>{kitchen?.name ?? "The kitchen"}</b>{kitchen?.address && <span>{kitchen.address}</span>}</div>
                  <div className="ui-slip-rule" />
                  {deliverTo(job)}
                  <div className="ui-slip-rule" />
                  <div className="ui-slip-lines">{job.items.map((i) => <div key={i.menu_item_id}><span>{i.qty} × {i.name}</span><span>{formatRupees(i.price_paise * i.qty)}</span></div>)}</div>
                </>
              )}
              <div className="ui-slip-rule" />
              <div className="ui-slip-total"><b>To collect at door</b><span>{formatRupees(job.total_paise)}</span></div>
              {callRow(job)}
            </div>
          </section>
          {jobs.length > 1 && <p className="mono ui-foot">{jobs.length - 1} more waiting</p>}
          <div className="ui-bottom">
            {out ? (
              <>
                {button(job, first, `Arriving · tell ${firstName(job.customer_name)}`, true)}
                {rest[0] && <button key="deliver" type="button" className="ui-btn big" aria-label={`${rest[0].label} ${shortId(job.id)}`} disabled={busyId === job.id} onClick={() => openCollect(job)}>Delivered</button>}
                {rest[1] && <button type="button" className="ui-btn text" aria-label={`${rest[1].label} ${shortId(job.id)}`} disabled={busyId === job.id} onClick={() => void act(job, rest[1])}>Not delivered</button>}
              </>
            ) : button(job, first, "Picked up")}
          </div>
        </>
      );
    }
    if (gate && !gate.online) return (   // R3
      <>
        <div className="ui-scroll ui-center"><div className="ui-empty"><h2>You are offline</h2><p className="ui-meta">While online, this phone shares your location.</p>{todayLine}</div></div>
        <div className="ui-bottom"><button type="button" className="ui-btn big" onClick={() => void gate.flip()}>Go online</button></div>
      </>
    );
    return (   // R4
      <>
        <div className="ui-scroll ui-center"><div className="ui-empty"><h2>Waiting for a delivery</h2><p className="ui-meta">No deliveries yet. Keep this page open.</p>{todayLine}</div></div>
        {gate && <div className="ui-bottom"><button type="button" className="ui-btn ghost big" onClick={() => void gate.flip()}>Go offline</button></div>}
      </>
    );
  };

  const head = tab === "job"
    ? (job || done ? { h: "Delivery", meta: `No. ${shortId((done ?? job)!.id)}` } : { h: "Deliveries", meta: gate ? (gate.online ? "Online" : "Offline") : "" })
    : tab === "today" ? { h: "Today", meta: `${today.length} delivered` } : { h: "Me", meta: gate?.name ?? "" };
  return (
    <>
      <header className="ui-head">
        <h1>{head.h}</h1>
        {head.meta && <span className="meta">{tab === "job" && !job && !done && gate && <span className={gate.online ? "ui-state-dot on" : "ui-state-dot"} aria-hidden="true" />}{head.meta}</span>}
      </header>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {tab === "job" && jobView()}
      {tab === "today" && (
        <div className="ui-scroll ui-today">
          <div className="ui-row ui-row-static ui-row-tall" data-testid="cash"><span className="ui-row-label"><span>Cash in hand</span><span className="ui-row-sub mono">Hand over at the kitchen tonight{hoursOf(kitchen)?.closes ? ` · day ends at ${hoursOf(kitchen)!.closes}` : ""}</span></span><span className="mono ui-cash">{formatRupees(cash)}</span></div>
          {handed > 0 && <div className="ui-row ui-row-static"><span className="ui-row-label"><span>Handed over</span><span className="ui-row-sub mono">The kitchen confirmed it</span></span><span className="mono">{formatRupees(handed)} handed over</span></div>}
          {today.length === 0 && <div className="ui-empty"><h2>No deliveries yet today</h2><p className="ui-meta">Each delivery lands here with its cash.</p></div>}
          {today.map((o) => (
            <div key={o.id} className="ui-row ui-row-static">
              <span className="ui-row-label"><span className="ui-row-sub mono">No. {shortId(o.id)} · {hhmm(o.updated_at)}</span><span>{o.customer_name || "Customer"} · {o.address}</span></span>
              <span className="mono">{formatRupees(o.total_paise)}</span>
              <span className="ui-row-sub mono">{paidLabel(o.paid_by)}</span>
            </div>
          ))}
        </div>
      )}
      {tab === "me" && (
        <div className="ui-scroll ui-today">
          {gate && <div className="ui-row ui-row-static ui-row-tall"><label htmlFor="online" className="ui-row-label"><span>Online</span><span className="ui-row-sub mono">Location shared {locationLabel()} while online</span></label><input id="online" className="ui-switch" type="checkbox" role="switch" checked={gate.online} onChange={() => void gate.flip()} /></div>}
          <div className="ui-row ui-row-static"><span>Today</span><span className="mono ui-row-sub">{today.length} delivered · {formatRupees(cash)} in hand</span></div>
          <div className="ui-row ui-row-static"><span>Your phone</span><span className="mono ui-row-sub">{gate?.phone || "Not saved yet"}</span></div>
          <button type="button" className="ui-row" onClick={() => window.dispatchEvent(new Event("gs-feedback"))}><span>Send feedback</span><span className="go" aria-hidden="true">›</span></button>
          {gate && <button type="button" className="ui-row" onClick={gate.signOut}><span>Sign out</span><span className="go" aria-hidden="true">›</span></button>}
        </div>
      )}
      <Tabs current={tab} tabs={TABS} onPick={setTab} />
    </>
  );
}
