// The kitchen app on the Ink v3 boards K3 to K6 (story H11, #194): New tickets, Cooking, the Kitchen tab, and one ticket (K4) over the tabs.
import { useState } from "react";
import { cookingTickets, deliveredToday, hhmm, newTickets, nextStep, outsideHours, readyTickets, shortId, type Order } from "../lib/kitchen";
import { formatRupees } from "../lib/money";
import { Skeleton, Tabs } from "../ui";
import { DishList } from "./KitchenTools";
import type { KitchenGateState } from "./KitchenGate";

type Tab = "new" | "cooking" | "kitchen";
type Props = {
  orders: Order[]; loading: boolean; error: string | null; busyId: string | null;
  onStep: (order: Order, to: string) => Promise<{ code: string; message: string } | null>;
  gate: KitchenGateState | null;   // null in the demo console: no open switch, no dishes
};
const STAMP: Record<string, [string, string]> = { placed: ["New", "placed"], accepted: ["Accepted", "accepted"], preparing: ["Cooking", "cooking"], ready: ["Ready", "ready"] };

export function KitchenScreen({ orders, loading, error, busyId, onStep, gate }: Props) {
  const [tab, setTab] = useState<Tab>("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const fresh = newTickets(orders);
  const cooking = cookingTickets(orders);
  const ready = readyTickets(orders);
  const done = deliveredToday(orders);
  const onSlips = done.reduce((n, o) => n + o.total_paise, 0);
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
    const [word, cls] = STAMP[o.status] ?? [o.status, ""];
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
  const pastClose = !!gate && outsideHours(gate.opensAt, gate.closesAt, hhmm(new Date().toISOString()));   // after closing time the customer app shows "closed" whatever the switch says
  const todayLine = <p className="mono ui-foot">Today · {done.length} done{tab === "kitchen" ? ` · ${formatRupees(onSlips)} on the slips` : ""}</p>;

  if (opened) {   // K4: one ticket over the tabs
    const [word, cls] = STAMP[opened.status] ?? [opened.status, ""];
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
