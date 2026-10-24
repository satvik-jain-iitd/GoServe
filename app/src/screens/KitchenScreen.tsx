// The kitchen app on the Ink v3 boards K3 to K6 (story H11, #194): New tickets, Cooking, the Kitchen tab, and one ticket (K4) over the tabs.
import { useEffect, useState } from "react";
import { cashByRider, cookingTickets, deliveredToday, hhmm, newTickets, nextStep, outsideHours, readyTickets, shortId, staffLabel, type Order } from "../lib/kitchen";
import { listRiders, type RiderListRow } from "../lib/admin";
import { getClient } from "../lib/supabase";
import { formatRupees } from "../lib/money";
import { Skeleton, Tabs } from "../ui";
import { DishList } from "./KitchenTools";
import type { KitchenGateState } from "./KitchenGate";

type Tab = "new" | "cooking" | "kitchen";
type Props = {
  orders: Order[]; loading: boolean; error: string | null; busyId: string | null;
  onStep: (order: Order, to: string) => Promise<{ code: string; message: string } | null>;
  onHandover: (riderId: string) => Promise<string | null>;   // story #229: the kitchen confirms a rider's cash
  gate: KitchenGateState | null;   // null in the demo console: no open switch, no dishes
};
const STAMP: Record<string, string> = { placed: "placed", accepted: "accepted", preparing: "cooking", ready: "ready" };
const stamp = (status: string): [string, string] => [staffLabel(status), STAMP[status] ?? ""];

export function KitchenScreen({ orders, loading, error, busyId, onStep, onHandover, gate }: Props) {
  const [tab, setTab] = useState<Tab>("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const fresh = newTickets(orders);
  const cooking = cookingTickets(orders);
  const ready = readyTickets(orders);
  const done = deliveredToday(orders, new Date(), gate ? { opens: gate.opensAt, closes: gate.closesAt } : null);   // story #229: the day ends at closing time
  const onSlips = done.reduce((n, o) => n + o.total_paise, 0);
  const [riders, setRiders] = useState<RiderListRow[]>([]);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  useEffect(() => {   // the riders' names for the hand-over rows; kitchen staff may read the riders table (A59)
    if (tab !== "kitchen" || !gate) return;
    listRiders(getClient()).then(setRiders).catch(() => setRiders([]));
  }, [tab, gate]);
  const riderName = (id: string) => riders.find((r) => r.user_id === id)?.name || `Rider ${shortId(id)}`;
  const handover = async (r: { rider_id: string; inHand: number; older: number }) => {
    const sum = formatRupees(r.inHand + r.older) + (r.older > 0 ? ` (${formatRupees(r.older)} from older days)` : "");
    if (!window.confirm(`Confirm ${sum} handed over by ${riderName(r.rider_id)}? This cannot be undone.`)) return;
    setHandoverError(await onHandover(r.rider_id));
  };
  const opened = openId ? orders.find((o) => o.id === openId) ?? null : null;
  const step = async (o: Order) => {
    const next = nextStep(o.status);
    if (!next) return;
    const failed = await onStep(o, next.to);
    if (!failed && opened) { setOpenId(null); setTab(next.to === "accepted" ? "cooking" : tab); }
  };
  const lines = (o: Order, prices = false) => (
    <div className="ui-slip-lines ui-ticket-big">{o.items.map((i) => <div key={i.menu_item_id}><span>{i.qty} × {i.name}</span>{prices && <span>{formatRupees(i.price_paise * i.qty)}</span>}</div>)}</div>
  );
  const row = (o: Order) => {
    const [word, cls] = stamp(o.status);
    const next = nextStep(o.status);
    return (
      <div key={o.id} className="ui-ticket">
        <button type="button" className="ui-ticket-open" aria-label={`Open ticket ${shortId(o.id)}`} onClick={() => setOpenId(o.id)}>
          <span className="ui-ticket-head"><span className="mono">No. {shortId(o.id)} · {hhmm(o.created_at)}</span><span className={`ui-tag ${cls === "cooking" ? "" : cls}`}>{word}</span></span>
          {lines(o)}
        </button>
        {next ? <button type="button" className="ui-btn big" aria-label={`${next.label} ${shortId(o.id)}`} disabled={busyId === o.id} onClick={() => void step(o)}>{next.label}</button>
          : <span className="mono ui-ticket-wait">Rider on the way</span>}
      </div>
    );
  };
  const state = gate ? (gate.open === null ? "Unknown" : gate.open ? "Open" : "Closed") : null;
  const dot = gate && <span className={gate.open ? "ui-state-dot on" : "ui-state-dot"} aria-hidden="true" />;
  const [minute, setMinute] = useState(() => hhmm(new Date().toISOString()));
  useEffect(() => { const t = setInterval(() => setMinute(hhmm(new Date().toISOString())), 60_000); return () => clearInterval(t); }, []);   // the clock line moves on its own
  const pastClose = !!gate && outsideHours(gate.opensAt, gate.closesAt, minute);   // after closing time the customer app shows "closed" whatever the switch says
  const todayLine = <p className="mono ui-foot">Today · {done.length} done{tab === "kitchen" ? ` · ${formatRupees(onSlips)} on the slips` : ""}</p>;

  if (opened) {   // K4: one ticket over the tabs
    const [word, cls] = stamp(opened.status);
    const next = nextStep(opened.status);
    return (
      <>
        <header className="ui-head">
          <button type="button" className="ui-back" aria-label={`Back to ${tab === "cooking" ? "cooking" : "new"} tickets`} onClick={() => setOpenId(null)}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
          <h1>Ticket</h1>
          <span className="meta">No. {shortId(opened.id)}</span>
        </header>
        {error && <p role="alert" className="ui-note error">{error}</p>}
        <div className="ui-scroll">
          <section className="ui-slip ui-slip-pad" aria-label={`Order ${shortId(opened.id)}`}>
            <div className="ui-slip-body">
              <div className="ui-slip-head"><span>Placed {hhmm(opened.created_at)}</span><span>Cash at the door</span></div>
              <div className="ui-slip-stamp"><span className={`ui-stamp ${cls}`}>{word}</span></div>
              {lines(opened, true)}
              <div className="ui-slip-rule" />
              <div className="ui-deliver"><span className="mono ui-kicker">Deliver to</span><b>{opened.customer_name || "The customer"}</b><span>{opened.address}</span></div>
              <div className="ui-slip-rule" />
              <div className="ui-slip-total"><b>Rider collects</b><span>{formatRupees(opened.total_paise)}</span></div>
            </div>
          </section>
          <p className="mono ui-foot">Accept, then Start when the pan is on, then Ready. The rider is called at Ready.</p>
        </div>
        <div className="ui-bottom">
          {next && <button type="button" className="ui-btn big" aria-label={`${next.label} ${shortId(opened.id)}`} disabled={busyId === opened.id} onClick={() => void step(opened)}>{next.label}</button>}
          <button type="button" className="ui-btn ghost big" onClick={() => setOpenId(null)}>Back to {tab === "cooking" ? "cooking" : "new"}</button>
        </div>
      </>
    );
  }
  const head = tab === "new" ? { h: "New", meta: state ? `${state} · ${fresh.length ? `${fresh.length} new` : "quiet"}` : `${fresh.length} new` }
    : tab === "cooking" ? { h: "Cooking", meta: state ? `${state} · ${cooking.length} on the stove` : `${cooking.length} on the stove` }
    : { h: "Kitchen", meta: gate?.name ?? "" };
  return (
    <>
      <header className="ui-head">
        <h1>{head.h}</h1>
        {head.meta && <span className="meta">{tab !== "kitchen" && dot}{head.meta}</span>}
      </header>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {loading && orders.length === 0 && <div className="ui-pad"><Skeleton lines={3} /></div>}
      {tab === "new" && (fresh.length === 0 ? (
        <div className="ui-scroll ui-center"><div className="ui-empty"><h2>No new tickets</h2><p className="ui-meta">New orders ring and show here. Keep this page open.</p>{todayLine}</div></div>
      ) : (
        <div className="ui-scroll ui-tickets">{fresh.map(row)}<p className="mono ui-foot">New tickets land here · accept within 2 min</p></div>
      ))}
      {tab === "cooking" && (
        <div className="ui-scroll ui-tickets">
          {cooking.length === 0 && ready.length === 0 && <div className="ui-empty"><h2>Nothing on the stove</h2><p className="ui-meta">Accepted tickets come here. Start when the pan is on, Ready when it is packed.</p></div>}
          {cooking.map(row)}
          {ready.length > 0 && <section className="ui-group"><h2>Ready · rider on the way</h2>{ready.map(row)}</section>}
        </div>
      )}
      {tab === "kitchen" && (
        <div className="ui-scroll ui-today">
          {todayLine}
          {gate ? (
            <>
              <div className="ui-row ui-row-static ui-row-tall">
                <label htmlFor="open" className="ui-row-label"><span>Open for orders</span><span className="ui-row-sub mono">{gate.open === null ? "Could not read the kitchen." : !gate.open ? "Closed · customers see it now" : pastClose ? `Past ${gate.closesAt} · customers see "closed" till opening time` : `${gate.closesAt ? `Till ${gate.closesAt} · ` : ""}customers see "closed" on their next look`}</span></label>
                {gate.open === null ? <button type="button" className="ui-btn ghost small" onClick={gate.retry}>Try again</button>
                  : <input id="open" className="ui-switch" type="checkbox" role="switch" checked={gate.open} onChange={() => void gate.flipOpen()} />}
              </div>
              {cashByRider(done, orders).map((r) => (
                <div key={r.rider_id} className="ui-row ui-row-static">
                  <span className="ui-row-label"><span>{riderName(r.rider_id)}</span><span className="ui-row-sub mono">{formatRupees(r.inHand)} in hand{r.handed > 0 ? ` · ${formatRupees(r.handed)} handed over` : ""}{r.older > 0 ? ` · older: ${formatRupees(r.older)}` : ""}</span></span>
                  <button type="button" className="ui-btn ghost small" aria-label={`Confirm hand-over ${riderName(r.rider_id)}`} disabled={r.inHand + r.older === 0} onClick={() => void handover(r)}>Confirm hand-over</button>
                </div>
              ))}
              {handoverError && <p role="alert" className="ui-note error">{handoverError}</p>}
              <DishList kitchenId={gate.kitchenId} />
              <button type="button" className="ui-row" onClick={gate.signOut}><span>Sign out</span><span className="go" aria-hidden="true">›</span></button>
            </>
          ) : <p className="ui-meta ui-pad">The open switch and the dishes are on the kitchen app, after a Google sign-in.</p>}
        </div>
      )}
      <Tabs current={tab} tabs={[{ key: "new", label: "New", icon: "new", badge: fresh.length }, { key: "cooking", label: "Cooking", icon: "cooking" }, { key: "kitchen", label: "Kitchen", icon: "kitchen" }]} onPick={setTab} />
    </>
  );
}
