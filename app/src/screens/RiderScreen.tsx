// The rider app on the Ink v3 boards R3 to R9 (story H11, #194): one delivery in hand (Job), today's cash (Today), and Me.
import { Fragment, useEffect, useRef, useState } from "react";
import { deliveredAt, deliveredToday, hhmm, riderActions, riderOrders, shortId, type Order, type RiderAction } from "../lib/kitchen";
import { formatRupees } from "../lib/money";
import { cashInHand, DOOR_NEAR_M, firstName, handedOver, hoursOf, type KitchenCard, type RiderGateState } from "../lib/rider";
import { distanceText, metres } from "../lib/riderMap";
import type { DoorMethod } from "../lib/doorMethods";
import { Skeleton, Tabs } from "../ui";
import { incentiveFor, type Rates } from "../lib/incentive";

type Tab = "job" | "today" | "me";
type Props = {
  orders: Order[]; loading: boolean; error: string | null; busyId: string | null; arrived: Map<string, string>;   // order id to when Arriving was sent
  onAct: (order: Order, action: RiderAction, method?: DoorMethod) => Promise<{ code: string; message: string } | null>;
  methods: DoorMethod[] | null;   // story 1262: the ways to collect that are on; null while the read is on its way, [] when it failed
  qrUrl: string | null | undefined;   // story 1263: the QR the admin uploaded; null when none is set or the read failed; undefined while the read is on its way
  onLoadMethods: () => void;
  gate: RiderGateState | null;   // null in the demo console: no online switch, no sign out
  kitchen: KitchenCard | null;   // the kitchen of the delivery in hand
  onAtDoor: (order: Order, metres: number | null) => void;   // story 1182: the rider tapped "I am at the door" while the phone said far
  onChangePaid: (order: Order, method: DoorMethod) => Promise<string | null>;
  incentive?: Rates | null;   // stories 1443 and 1438: the admin's switch and its recent changes; null when the read failed or is on its way   // story 1448: put a wrong cash or UPI tap right; the refusal code, or null when saved
};
const TABS: { key: Tab; label: string; icon: Tab }[] = [{ key: "job", label: "Delivery", icon: "job" }, { key: "today", label: "Today", icon: "today" }, { key: "me", label: "Me", icon: "me" }];

export function RiderScreen({ orders, loading, error, busyId, arrived, onAct, methods: methodsRead, qrUrl, onLoadMethods, gate, kitchen, onAtDoor, onChangePaid, incentive = null }: Props) {
  const methods = qrUrl === undefined ? null : methodsRead;   // the screen names nothing until both answers are in
  const [tab, setTab] = useState<Tab>("job");
  const [doneId, setDoneId] = useState<string | null>(null);   // the slip just delivered stays until "Next delivery" (R7)
  const jobs = riderOrders(orders);
  // Story 1441, review of PR 1469: while a trip's pickups run, or after one failed, the packets still at the kitchen stay on Pick up; never On the way with a packet left.
  const [tripIds, setTripIds] = useState<string[] | null>(null);
  const job = (tripIds ? jobs.find((o) => o.status === "ready" && tripIds.includes(o.id)) : undefined) ?? jobs[0] ?? null;
  const done = doneId ? orders.find((o) => o.id === doneId) ?? null : null;
  const today = deliveredToday(orders, new Date(), hoursOf(kitchen));   // story #229: the day ends at the kitchen's closing time
  const cash = cashInHand(today);
  const handed = handedOver(today);
  const paidLabel = (p: string | null | undefined) => (p === "upi_door" ? "Paid by UPI" : p === "cash" ? "Cash collected" : "Collected");   // never guess cash: an empty paid_by is just Collected
  const paidShort = (p: string | null | undefined) => (p === "upi_door" ? "UPI" : p === "cash" ? "Cash" : "Collected");   // board TI1
  // Story 1448: Change stays until the night's hand-over. A UPI order is never stamped itself, so any of his cash stamped at or after this delivery closes it too (the server's rule).
  const canChange = (o: Order) => (o.paid_by === "cash" || o.paid_by === "upi_door") && !o.cash_handed_at && !orders.some((x) => !!x.cash_handed_at && x.cash_handed_at >= deliveredAt(o));
  const [changeId, setChangeId] = useState<string | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeErr, setChangeErr] = useState<string | null>(null);
  const change = async (o: Order, m: DoorMethod) => {
    setChangeBusy(true);
    const code = await onChangePaid(o, m);
    setChangeBusy(false); setChangeId(null);
    setChangeErr(code === null ? null : code === "handed_over" ? "Cash kitchen me jama ho chuka hai. Ab badalna ho to kitchen se kahein." : code === "method_off" ? "Ye tareeka abhi band hai. Admin se poochhein." : "Badal nahin paye. Network dekh kar phir try karein.");
  };
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
  // Story #1182 (board RX3): Google Maps directions to the customer's exact pin (a link, no API cost). No pin on the order: no Navigate, never a wrong place.
  const directions = (o: Order) => typeof o.drop_lat === "number" && typeof o.drop_lng === "number" ? `https://www.google.com/maps/dir/?api=1&destination=${o.drop_lat},${o.drop_lng}&travelmode=two-wheeler` : null;
  // Board RX3 (owner, 13 Nov 2026): the name and the address, and beside them two round 48 px buttons with no words: Call (outline) and Navigate (filled).
  const whoRow = (o: Order) => {
    const to = directions(o);
    return (
      <div className="ui-rx-who">
        <div className="ui-deliver"><b>{o.customer_name || "The customer"}</b><span>{o.address}</span></div>
        <div className="ui-rx-acts">
          {o.customer_phone && <a className="ui-round ghost" href={`tel:${o.customer_phone}`} aria-label={`Call ${firstName(o.customer_name)}`}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></a>}
          {to && <a className="ui-round" href={to} target="_blank" rel="noopener noreferrer" aria-label="Navigate"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M3 11 21 3l-8 18-2-8-8-2z" /></svg></a>}
        </div>
      </div>
    );
  };
  // Story 1182 (boards RY1 to RY3): the bottom zone holds one button at a time. Far from the pin: the distance and "I am at the door".
  // Near (DOOR_NEAR_M) or no pin or no place from the phone: Arriving. After Arriving (saved on the server): "Say at the door" and Collect.
  const pinOf = (o: Order) => (typeof o.drop_lat === "number" && typeof o.drop_lng === "number" ? { lat: o.drop_lat, lng: o.drop_lng } : null);
  const [here, setHere] = useState<{ lat: number; lng: number } | "none" | null>(null);   // null: still finding the phone's place
  const [doorTap, setDoorTap] = useState<string | null>(null);
  const nearSeen = useRef<string | null>(null);   // once near, Arriving stays for that order: a jumpy place never takes it away
  const watchId = job && job.status === "out_for_delivery" && pinOf(job) && !arrived.has(job.id) ? job.id : null;
  useEffect(() => {
    if (!watchId) return;
    let watch: number | null = null;
    let gone = false;
    const none = () => { if (!gone) setHere("none"); };   // a rider is never stuck on step 1
    if (!("geolocation" in navigator) || !navigator.permissions) { none(); return; }
    void navigator.permissions.query({ name: "geolocation" as PermissionName }).then((perm) => {
      if (gone) return;
      if (perm.state !== "granted") { none(); return; }
      watch = navigator.geolocation.watchPosition((at) => { if (!gone) setHere({ lat: at.coords.latitude, lng: at.coords.longitude }); }, none, { enableHighAccuracy: true, maximumAge: 10_000 });
    }).catch(none);
    return () => { gone = true; if (watch !== null) navigator.geolocation.clearWatch(watch); };
  }, [watchId]);
  const doorOf = (o: Order) => {
    const pin = pinOf(o);
    const at = here && here !== "none" ? here : null;
    const away = pin && at ? metres(at.lat, at.lng, pin.lat, pin.lng) : null;
    const awayText = pin && at ? distanceText(at.lat, at.lng, pin.lat, pin.lng) : null;
    if (away !== null && away <= DOOR_NEAR_M) nearSeen.current = o.id;
    const step = arrived.has(o.id) ? 3 : !pin || here === "none" || doorTap === o.id || nearSeen.current === o.id ? 2 : 1;
    return { step, away, awayText };
  };
  const riderFirst = (gate?.name ?? "").trim().split(/\s+/)[0];
  // Story 1441 (boards RT1, RT2; owner: "tick wala tareeka"): every ready packet of the kitchen goes in one trip. Each is ticked into the bag; a packet left on the counter never goes as picked up.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [tripBusy, setTripBusy] = useState(false);
  const toggle = (id: string) => setTicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const pickAll = async (trip: Order[]) => {   // each packet is its own save, in turn; the first one that fails stops the rest and its error shows
    setTripBusy(true); setTripIds(trip.map((o) => o.id));
    let failed = false;
    for (const o of trip) { const up = riderActions(o.status)[0]; if (up && (await onAct(o, up))) { failed = true; break; } }
    setTripBusy(false);
    if (!failed) setTripIds(null);   // all in the bag: On the way. A failure keeps the rest on Pick up, with its error
  };
  const todayLine = <p className="mono ui-foot">Today · {today.length} delivered</p>;

  const jobView = () => {
    if (loading && orders.length === 0) return <div className="ui-pad"><Skeleton lines={3} /></div>;
    const changing = changeId && done?.id === changeId ? done : null;   // story 1448: Change opens the same two choices again
    const collecting = changing ?? (collectId ? jobs.find((o) => o.id === collectId) ?? null : null);
    if (collecting && (changing || !done)) {   // R7 Collect payment: the rider says how it was paid, and that marks the order delivered
      const deliver = changing ? undefined : riderActions(collecting.status).find((a) => a.kind === "status" && a.to === "delivered");
      const amount = formatRupees(collecting.total_paise);
      const busy = changing ? changeBusy : busyId === collecting.id;
      const pick = (m: DoorMethod) => (changing ? void change(changing, m) : deliver ? void act(collecting, deliver, m) : undefined);
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
              {upi && <p className="ui-meta">Pehle paisa, phir button.</p>}
              {upiNeedsQr && <p className="ui-meta">UPI at the door has no QR yet. Take cash, or ask the admin to upload the QR.</p>}
            </div>
          </section>
          <div className="ui-bottom">
            {methods !== null && methods.length === 0 && <button type="button" className="ui-btn big" onClick={onLoadMethods}>Try again</button>}
            {(deliver || changing) && cash && <button type="button" className={upi ? "ui-btn ghost big" : "ui-btn big"} disabled={busy} onClick={() => pick("cash")}>Took cash {amount}</button>}
            {(deliver || changing) && upi && <button type="button" className="ui-btn big" disabled={busy} onClick={() => pick("upi_door")}>Paid by UPI {amount}</button>}
            <button type="button" className="ui-btn text" disabled={busy} onClick={() => (changing ? setChangeId(null) : setCollectId(null))}>Back</button>
          </div>
        </>
      );
    }
    if (done) return (   // R7; story 1448, boards DV1 and DV2: the customer's name only, Change, the cash he holds, and a true next step
      <>
        <section className="ui-slip ui-slip-pad" aria-label={`Order ${shortId(done.id)}`}>
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>{done.customer_name || "Customer"}</span></div>
            <div className="ui-slip-stamp"><span className="ui-stamp delivered">Delivered</span></div>
            <p className="ui-clock">At the door <b>{hhmm(deliveredAt(done))}</b></p>
            <div className="ui-slip-rule" />
            <div className="ui-slip-total"><b>{paidLabel(done.paid_by)}</b><span>{formatRupees(done.total_paise)}</span></div>
            {canChange(done) && <button type="button" className="ui-rx-change" onClick={() => { setChangeErr(null); setChangeId(done.id); onLoadMethods(); }}>Change</button>}
            {changeErr && <p role="alert" className="ui-note error">{changeErr}</p>}
          </div>
        </section>
        <p className="mono ui-foot">Cash aapke paas {formatRupees(cash)}</p>
        <div className="ui-bottom">
          {!job && <p role="status" className="ui-rx-next">Koi order nahin · kitchen par lautein</p>}
          <button type="button" className="ui-btn big" onClick={() => { setDoneId(null); setChangeErr(null); }}>{job ? "Next delivery" : "Done"}</button>
        </div>
      </>
    );
    if (job && job.status === "ready") {
      const trip = jobs.filter((o) => o.status === "ready" && o.kitchen_id === job.kitchen_id);
      const more = jobs.length - trip.length;
      if (trip.length > 1) {   // boards RT1 and RT2
        const left = trip.filter((o) => !ticked.has(o.id)).length;
        return (
          <>
            <div className="ui-scroll ui-rx-scroll">
              <section className="ui-slip ui-slip-pad" aria-label="Pick up, this trip">
                <div className="ui-slip-body ui-trip">
                  <span className="mono ui-kicker">This trip · {trip.length} packets</span>
                  {trip.map((o, i) => (
                    <Fragment key={o.id}>
                      {i > 0 && <div className="ui-slip-rule" />}
                      <button type="button" role="checkbox" aria-checked={ticked.has(o.id)} className="ui-tick-row" onClick={() => toggle(o.id)}>
                        <span className="ui-tick" aria-hidden="true">{ticked.has(o.id) && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
                        <span className="ui-tick-body">
                          <span className="ui-tick-top"><span className="display ui-tick-no">{shortId(o.id)}</span><span className="mono">{formatRupees(o.total_paise)}</span></span>
                          <span>{o.items.map((x) => `${x.qty} × ${x.name}`).join(", ")}</span>
                          <span className="ui-tick-addr">{o.address}</span>
                        </span>
                      </button>
                    </Fragment>
                  ))}
                  <div className="ui-slip-rule" />
                  <div className="ui-slip-total"><b>To collect, {trip.length} doors</b><span>{formatRupees(trip.reduce((n, o) => n + o.total_paise, 0))}</span></div>
                </div>
              </section>
              {more > 0 && <p className="mono ui-foot">{more} more waiting</p>}
            </div>
            <div className="ui-bottom">
              {left > 0 && <p role="status" className="ui-rx-next">{left} packet baaki · thaile me rakh kar tick karein</p>}
              <button type="button" className="ui-btn big" disabled={left > 0 || tripBusy} onClick={() => void pickAll(trip)}>Picked up all {trip.length}</button>
            </div>
          </>
        );
      }
      return (   // board RP3: one order alone
        <>
          <div className="ui-scroll ui-rx-scroll">
            <section className="ui-slip ui-slip-pad" aria-label={`Pick up order ${shortId(job.id)}`}>
              <div className="ui-slip-body">
                <div className="ui-pick">
                  <span className="mono ui-kicker">Order number</span>
                  <span className="display ui-pick-no">{shortId(job.id)}</span>
                  <span className="ui-pick-items">{job.items.map((x) => <span key={x.menu_item_id}>{x.qty} × {x.name}</span>)}</span>
                </div>
                <div className="ui-slip-rule" />
                <div className="ui-pick"><span className="mono ui-kicker">Deliver to</span><span className="ui-pick-addr">{job.address}</span></div>
                <div className="ui-slip-rule" />
                <div className="ui-slip-total"><b>To collect at door</b><span>{formatRupees(job.total_paise)}</span></div>
              </div>
            </section>
            {jobs.length > 1 && <p className="mono ui-foot">{jobs.length - 1} more waiting</p>}
          </div>
          <div className="ui-bottom">{button(job, riderActions(job.status)[0], "Picked up")}</div>
        </>
      );
    }
    if (job) {   // R6, on the way (ready is above)
      const [first, ...rest] = riderActions(job.status);
      const door = doorOf(job);
      const told = arrived.get(job.id);
      return (
        <>
          <div className="ui-scroll ui-rx-scroll">   {/* story 1182: a long address or note scrolls; the buttons and the tabs stay on the screen */}
          <section className="ui-slip ui-slip-pad" aria-label={`Order ${shortId(job.id)}`}>
            <div className="ui-slip-body">
              {whoRow(job)}
              {job.instructions && <p className="ui-rx-note"><span className="mono ui-rx-note-k">Note ·</span> {job.instructions}</p>}
              <div className="ui-slip-rule" />
              <div className="ui-slip-total"><b>To collect at door</b><span>{formatRupees(job.total_paise)}</span></div>
              {rest[1] && <button type="button" className="ui-rx-cant" disabled={busyId === job.id} onClick={() => void act(job, rest[1])}>Could not deliver?</button>}
            </div>
          </section>
          {door.step === 3 && (
            <section className="ui-rx-say" aria-label="Say at the door">
              <p className="mono ui-rx-say-k">Say at the door</p>
              <p>Namaste sir, main {riderFirst ? `${riderFirst}, ` : ""}GoServe kitchen team se. Thank you for ordering.</p>
            </section>
          )}
          {jobs.length > 1 && <p className="mono ui-foot">{jobs.length - 1} more waiting</p>}
          </div>
          <div className="ui-bottom">
            {door.step === 1 && (
              <div className="ui-rx-door">
                {door.awayText && <p className="mono">{door.awayText} to the door</p>}
                <button type="button" className="ui-rx-link" onClick={() => { setDoorTap(job.id); onAtDoor(job, door.away === null ? null : Math.round(door.away)); }}>I am at the door</button>
              </div>
            )}
            {door.step === 2 && door.awayText && <p className="mono ui-rx-door">{door.awayText} to the door</p>}
            {door.step === 2 && button(job, first, `Arriving · tell ${firstName(job.customer_name)}`)}
            {door.step === 3 && told && <p className="mono ui-rx-door">{firstName(job.customer_name)} was told at {hhmm(told)}</p>}
            {door.step === 3 && rest[0] && <button type="button" className="ui-btn big" disabled={busyId === job.id} onClick={() => openCollect(job)}>Collect {formatRupees(job.total_paise)}</button>}
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
    ? (job && !done && job.status === "ready" ? { h: "Pick up", meta: "Ready" }   // boards RP3 and RT1
      : job || done ? { h: job && !done && job.status === "out_for_delivery" ? "On the way" : "Delivery", meta: `No. ${shortId((done ?? job)!.id)}` } : { h: "Deliveries", meta: gate ? (gate.online ? "Online" : "Offline") : "" })
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
          <div className="ui-row ui-row-static ui-row-tall" data-testid="cash"><span className="ui-row-label"><span>Cash aapke paas</span><span className="ui-row-sub mono">Aaj raat kitchen me jama karein{hoursOf(kitchen)?.closes ? ` · ${hoursOf(kitchen)!.closes} tak` : ""}</span></span><span className="mono ui-cash">{formatRupees(cash)}</span></div>
          {incentive?.on && (() => {   // board TI1: never part of the cash he holds; each delivery at the amount set when it was delivered
            const inc = incentiveFor(today, incentive.log);
            return <div className="ui-row ui-row-static ui-row-tall" data-testid="incentive"><span className="ui-row-label"><span>Aaj ka incentive</span><span className="ui-row-sub mono">{inc.count} delivery{inc.amounts.length === 1 ? ` × ${formatRupees(inc.amounts[0])}` : ""}{inc.count < today.length ? " incentive ke baad" : ""} · salary ke saath milega</span></span><span className="mono ui-cash">{formatRupees(inc.total_paise)}</span></div>;
          })()}
          {handed > 0 && <div className="ui-row ui-row-static"><span className="ui-row-label"><span>Handed over</span><span className="ui-row-sub mono">The kitchen confirmed it</span></span><span className="mono">{formatRupees(handed)} handed over</span></div>}
          {today.length === 0 && <div className="ui-empty"><h2>No deliveries yet today</h2><p className="ui-meta">Each delivery lands here with its cash.</p></div>}
          {today.map((o) => (
            <button key={o.id} type="button" className="ui-row" onClick={() => { setChangeErr(null); setChangeId(null); setDoneId(o.id); setTab("job"); }}>   {/* story 1448, board TC2: a row opens its Delivered slip */}
              <span className="ui-row-label"><span className="ui-row-sub mono">No. {shortId(o.id)} · {hhmm(deliveredAt(o))}</span><span>{o.customer_name || "Customer"} · {o.address}</span></span>
              <span className="ui-row-end"><span className="mono">{formatRupees(o.total_paise)}</span><span className="ui-row-sub mono">{paidShort(o.paid_by)}</span></span>
              <span className="go" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      )}
      {tab === "me" && (
        <div className="ui-scroll ui-today">
          {/* Board MC1 (stories 1445 and 1440): rows only. Going online or offline lives on the Delivery tab. */}
          <div className="ui-row ui-row-static"><span>Phone</span><span className="mono ui-row-sub">{gate?.phone || "Not saved yet"}</span></div>
          {typeof kitchen?.lat === "number" && typeof kitchen?.lng === "number" && <a className="ui-row" href={`https://www.google.com/maps/dir/?api=1&destination=${kitchen.lat},${kitchen.lng}&travelmode=two-wheeler`} target="_blank" rel="noopener noreferrer"><span>Kitchen ka raasta</span><span className="go" aria-hidden="true">›</span></a>}
          {kitchen?.phone && <a className="ui-row" href={`tel:${kitchen.phone}`}><span>Kitchen ko call</span><span className="go" aria-hidden="true">›</span></a>}
          <button type="button" className="ui-row" onClick={() => window.dispatchEvent(new Event("gs-feedback"))}><span>Send feedback</span><span className="go" aria-hidden="true">›</span></button>
          {gate && <button type="button" className="ui-row" onClick={gate.signOut}><span>Sign out</span><span className="go" aria-hidden="true">›</span></button>}
        </div>
      )}
      <Tabs current={tab} tabs={TABS} onPick={setTab} />
    </>
  );
}
