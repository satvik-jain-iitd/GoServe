// The one bill screen of the Ink v3 boards 04 and 04e (story H10c, #193): the slip, who and where, and Place order. It replaces the cart and the old bill.
import type { Line } from "../lib/cart";
import { formatRupees } from "../lib/money";
import { isPhone } from "../lib/profile";
import { PAY_METHODS, type PayMethod } from "../lib/payments";
import type { Alternative, Quote } from "../lib/quote";
import { useState } from "react";

type Props = {
  lines: Line[]; total: number; kitchenName: string; pin: string | null;
  address: string; onAddress: (v: string) => void;
  details?: { name: string; phone: string; onName: (v: string) => void; onPhone: (v: string) => void; gate?: boolean };   // the customer app also asks who and which phone (story B3)
  offers?: { quote: Quote; codeError: string | null; onApply: (code: string) => void; onRemove: () => void };   // story #588: the quote's bill and the Offers block (boards C1, C2)
  soldOut?: { id: string; name: string; alt: Alternative | null | undefined; canSwap: boolean; onSwap: () => void; onRemove: () => void };   // story #619, board L3: the first dish in the bill that is sold out
  pay?: { value: PayMethod; onChange: (v: PayMethod) => void };   // story #552: how you pay (the customer app only)
  sending: boolean; error: string | null;
  onBack: () => void; onPlace: () => void;
};

const plain = (paise: number) => formatRupees(paise).replace("₹", "");
export const BackChevron = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" className="ui-back" aria-label={label} onClick={onClick}>
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square"><path d="M15 6l-6 6 6 6" /></svg>
  </button>
);

export function BillScreen({ lines, total, kitchenName, pin, address, onAddress, details, offers, soldOut, pay, sending, error, onBack, onPlace }: Props) {
  const [typed, setTyped] = useState("");
  const q = offers?.quote;
  const empty = lines.length === 0;
  const ready = !empty && !soldOut && address.trim().length > 0 && (!details || details.gate || (details.name.trim().length > 0 && isPhone(details.phone)));   // story #551: with the phone code on, the sheets ask the number and the name
  const head = [kitchenName, pin].filter(Boolean).join(" · ");
  return (
    <>
      <header className="ui-head">
        <BackChevron label="Back to menu" onClick={onBack} />
        <h1>Your bill</h1>
      </header>
      <div className="ui-scroll">
        <section className="ui-slip ui-slip-pad" aria-label={empty ? "Empty bill" : "Items"}>
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>{head}</span></div>
            {empty ? (
              <div className="ui-empty ui-empty-slip">
                <h2>Nothing on it yet</h2>
                <p className="ui-meta">Add a dish from the menu.</p>
                <button type="button" className="ui-btn" onClick={onBack}>See the menu</button>
              </div>
            ) : (
              <div className="ui-slip-lines">
                {lines.map(({ dish, qty, line_paise }) => soldOut?.id === dish.id
                  ? <div key={dish.id} style={{ color: "var(--gs-text-muted)", textDecoration: "line-through" }}><span>{qty} × {dish.name}</span><span>{plain(line_paise)}</span></div>
                  : <div key={dish.id}><span>{qty} × {dish.name}</span><span>{plain(line_paise)}</span></div>)}
                <div><span>Delivery</span><span>{q && q.fees.delivery_paise > 0 ? plain(q.fees.delivery_paise) : "Free"}</span></div>
                {q && q.fees.packaging_paise > 0 && <div><span>Packaging</span><span>{plain(q.fees.packaging_paise)}</span></div>}
                {q && q.tax_mode === "exclusive" && q.tax_paise > 0 && <div><span>Tax</span><span>{plain(q.tax_paise)}</span></div>}
                {q && q.coupon && q.discount_paise - (q.swap_discount_paise ?? 0) > 0 && <div><span>Discount · {q.coupon.code}</span><span>−{plain(q.discount_paise - (q.swap_discount_paise ?? 0))}</span></div>}
                {q && (q.swap_discount_paise ?? 0) > 0 && <div><span>Swap discount</span><span>−{plain(q.swap_discount_paise!)}</span></div>}
              </div>
            )}
            <div className="ui-slip-rule" />
            <div className={empty ? "ui-slip-total ui-muted" : "ui-slip-total"}><b>{q ? "To pay" : "Cash at door"}</b><span data-testid="bill-total">{formatRupees(total)}</span></div>
            {!empty && <button type="button" className="ui-btn ghost ui-add-more" onClick={onBack}>+ Add more</button>}
          </div>
        </section>
        {soldOut && (
          <div role="alert" className="ui-swap">
            <p className="ui-swap-reason">{soldOut.name} is sold out.</p>
            {soldOut.alt && soldOut.canSwap && (
              <>
                <div className="ui-swap-alt">
                  <div>
                    <p className="ui-swap-try">Try {soldOut.alt.name} instead</p>
                    <p className="ui-swap-price"><span className="mono">{formatRupees(soldOut.alt.price_paise - soldOut.alt.discount_paise)}</span> <span className="mono was">{formatRupees(soldOut.alt.price_paise)}</span> · {Math.round((100 * soldOut.alt.discount_paise) / Math.max(1, soldOut.alt.price_paise))}% off from us, sorry for the trouble</p>
                  </div>
                </div>
                <div className="ui-swap-actions">
                  <button type="button" className="ui-btn" onClick={soldOut.onSwap}>Swap it in</button>
                  <button type="button" className="ui-btn ghost" onClick={soldOut.onRemove}>Take it out</button>
                </div>
              </>
            )}
            {!(soldOut.alt && soldOut.canSwap) && <div className="ui-swap-actions"><button type="button" className="ui-btn ghost" onClick={soldOut.onRemove}>Take it out</button></div>}
          </div>
        )}
        {offers && (offers.quote.offers.length > 0 || offers.quote.coupon) && (
          <section aria-label="Offers" style={{ margin: "16px 20px 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: "0 0 4px 0", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 400, textTransform: "uppercase", color: "var(--gs-text-muted)" }}>Offers</h2>
            {offers.quote.offers.map((o) => {
              const on = offers.quote.coupon?.code === o.code;
              return (
                <div key={o.code} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, padding: "0 12px", border: on ? "2px solid var(--md-primary)" : "1px solid var(--md-outline-variant)", borderRadius: 6, background: "var(--md-surface)" }}>
                  {on
                    ? <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--md-primary)", color: "var(--md-on-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"><path d="M5 12l5 5 9-10" /></svg></span>
                    : <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--md-outline-variant)", boxSizing: "border-box", flex: "none" }} />}
                  <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500 }}>{o.code}</span><span style={{ fontSize: 13, color: "var(--gs-text-muted)" }}>{o.title}</span></span>
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Save {formatRupees(o.saves_paise)}</span>
                  {on && <button type="button" aria-label={`Remove ${o.code}`} onClick={offers.onRemove} style={{ border: 0, background: "none", padding: "0 0 0 4px", color: "var(--md-primary)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Remove</button>}
                    {!on && <button type="button" aria-label={`Apply ${o.code}`} onClick={() => offers.onApply(o.code)} style={{ border: 0, background: "none", padding: "0 0 0 4px", color: "var(--md-primary)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Apply</button>}
                </div>
              );
            })}
            <form style={{ display: "flex", gap: 8, marginTop: 4 }} onSubmit={(e) => { e.preventDefault(); if (typed.trim()) offers.onApply(typed); }}>
              <label htmlFor="code" style={{ position: "absolute", left: -9999 }}>Have a code?</label>
              <input id="code" type="text" placeholder="Have a code?" autoCapitalize="characters" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} maxLength={40}
                aria-invalid={offers.codeError ? true : undefined}
                style={{ flex: 1, minWidth: 0, height: 44, padding: "0 12px", border: `1px solid ${offers.codeError ? "var(--md-error)" : "var(--md-outline-variant)"}`, borderRadius: 6, background: "var(--md-surface)", color: "inherit", font: "inherit", fontFamily: "'DM Mono', monospace", fontSize: 14 }} />
              <button type="submit" aria-label="Apply code" style={{ height: 44, padding: "0 16px", border: "1px solid var(--md-primary)", borderRadius: 6, background: "none", color: "var(--md-primary)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Apply</button>
            </form>
            {offers.codeError && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--md-error)" }}>{offers.codeError}</p>}
          </section>
        )}
        {!empty && (
          <form className="ui-form" onSubmit={(e) => e.preventDefault()}>
            {details && !details.gate && (
              <>
                <div className="ui-field"><label htmlFor="name">Your name</label><input id="name" type="text" value={details.name} maxLength={80} autoComplete="name" onChange={(e) => details.onName(e.target.value)} /></div>
                <div className="ui-field"><label htmlFor="phone">Phone · the rider calls this</label><input id="phone" className="mono-input" type="tel" value={details.phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" onChange={(e) => details.onPhone(e.target.value.replace(/\D/g, ""))} /></div>
              </>
            )}
            <div className="ui-field"><label htmlFor="address">Address · food gets delivered here</label><textarea id="address" rows={2} value={address} maxLength={300} onChange={(e) => onAddress(e.target.value)} /></div>
            {pay && (
              <fieldset className="ui-pay" role="radiogroup" aria-label="How you pay">
                <legend>How you pay</legend>
                {PAY_METHODS.map((m) => (
                  <label key={m.id} className="ui-pay-row"><input type="radio" name="pay" checked={pay.value === m.id} onChange={() => pay.onChange(m.id)} /><span>{m.label}</span></label>
                ))}
              </fieldset>
            )}
            {pay && pay.value !== "cod" && <p className="ui-note">You pay on the next screen. The kitchen starts when it is paid.</p>}
            {error && <p role="alert" className="ui-field-error">{error}</p>}
          </form>
        )}
      </div>
      {!empty && (
        <div className="ui-sticky float">
          {!ready && <p className="ui-note ui-bar-note">Add your name, phone and address to place the order.</p>}
          <button type="button" className="ui-btn bar" disabled={!ready || sending} onClick={onPlace}>
            <span className="mono">{pay && pay.value !== "cod" ? PAY_METHODS.find((m) => m.id === pay.value)!.label : "Cash"} · {formatRupees(total)}</span><span className="verb">{sending ? "Placing…" : soldOut ? "Fix the bill first" : "Place order ›"}</span>
          </button>
        </div>
      )}
    </>
  );
}
