// The one bill screen of the Ink v3 boards 04 and 04e (story H10c, #193): the slip, who and where, and Place order. It replaces the cart and the old bill.
import type { Line } from "../lib/cart";
import { formatRupees } from "../lib/money";
import { isPhone } from "../lib/profile";
import { DOOR_METHODS, type DoorMethod } from "../lib/doorMethods";
import type { Alternative, Quote } from "../lib/quote";
import { useEffect, useRef, useState } from "react";
import { SIGN_IN_LINE } from "../lib/errorLines";
import { TornTop, useSheetFit } from "../ui";

type Props = {
  lines: Line[]; total: number; kitchenName: string; pin: string | null;
  farKm?: number | null;   // story 1548: the km from the phone's last known place to the delivery place, when it is past the far distance; else null
  address: string; confirmed: boolean; onChangePlace: () => void; onConfirmPlace: () => void;   // story 1532: the words of the stored place, never a text box; confirmed = it has a point the customer set
  note: string; onNote: (v: string) => void;   // story #935: one optional line for the kitchen, up to 200 characters
  details?: { phone: string; onPhone: (v: string) => void; saved: string | null };   // story 1417 (boards BF1, BF2, BC1): the phone once, never the name; saved = the phone kept on the account
  offers?: { quote: Quote; codeError: string | null; onApply: (code: string) => void; onRemove: () => void };   // story #588: the quote's bill and the Offers block (boards C1, C2)
  soldOut?: { id: string; name: string; line?: string; alt: Alternative | null | undefined; canSwap: boolean; onSwap: () => void; onRemove: () => void };   // story 619, board L3: the first dish in the bill that is sold out; line (story 1540): other words for a dish the kitchen does not make
  door?: { methods: DoorMethod[]; value: DoorMethod | null; onChange: (v: DoorMethod) => void };   // story #1261, board P6: how you pay at the door, only the methods that are on (the customer app only)
  sending: boolean; error: string | null; onSignIn?: () => void;   // story 1580: the sign-in line carries its own way out
  under?: string | null;   // story 1540: one short line under the title, inside the header, so nothing on the Bill moves (the kitchen changed)
  onBack: () => void; onPlace: () => void;
};

export const NOTE_MAX = 200;
export const CONFIRM_PLACE_LINE = "Confirm your place on the map to place the order.";
// Story 1532: where the food goes, as words with Change (the Bill and You). The same row as the saved phone (board BF2).
// Story 1548, rule 11: far from the phone, the row says how far, in the place of the small "Deliver to" label (the reviewer's call): no line is added, so the row has
// one height either way (owner's rule 23). The row's own name stays "Deliver to". farKm null or not given: not far, or the phone's place is not known.
export const PlaceRow = ({ words, onChange, farKm }: { words: string; onChange: () => void; farKm?: number | null }) => (
  <div className="ui-phone-row" role="group" aria-label="Serving at"><span><small className="mono">{farKm == null ? "Serving at" : `${farKm} km from your current location`}</small><span>{words.trim() || "Not set yet"}</span></span><button type="button" className="ui-pinmap-change" aria-label="Change address" onClick={onChange}>Change</button></div>
);
const plain = (paise: number) => formatRupees(paise).replace("₹", "");
export const BackChevron = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" className="ui-back" aria-label={label} onClick={onClick}>
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square"><path d="M15 6l-6 6 6 6" /></svg>
  </button>
);

// Story 1706 (owner, 20 Nov 2026): the sold-out offer is a bottom sheet that needs an answer. No close control, no tap-outside, no Escape, no history step:
// Back leaves the Bill, and the Bill opens the sheet again while the dish is still sold out. Focus is on the dialog itself (so Enter swaps nothing) and stays inside it.
function SwapSheet({ soldOut, alt }: { soldOut: NonNullable<Props["soldOut"]>; alt: Alternative }) {
  const fit = useSheetFit();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const keep = (e: FocusEvent) => { if (!box.current?.contains(e.target as Node)) box.current?.focus(); };
    document.addEventListener("focusin", keep);
    return () => document.removeEventListener("focusin", keep);
  }, []);
  return (
    <div ref={fit} className="ui-sheet-back">
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="swap-head" tabIndex={-1} className="ui-sheet ui-swap-sheet">
        <div className="ui-sheet-head"><h2 id="swap-head">{soldOut.line ?? `${soldOut.name} is sold out`}</h2></div>
        <p className="ui-swap-try">Try {alt.name} instead</p>
        <p className="ui-swap-price"><span className="mono">{formatRupees(alt.price_paise - alt.discount_paise)}</span> <span className="mono was">{formatRupees(alt.price_paise)}</span> · {Math.round((100 * alt.discount_paise) / Math.max(1, alt.price_paise))}% off from us, sorry for the trouble</p>
        <div className="ui-sheet-acts">
          <button type="button" className="ui-btn ghost big" onClick={soldOut.onRemove}>Take it out</button>
          <button type="button" className="ui-btn big" onClick={soldOut.onSwap}>Swap it in</button>
        </div>
      </div>
    </div>
  );
}

export function BillScreen({ lines, total, kitchenName, pin, address, farKm = null, confirmed, onChangePlace, onConfirmPlace, note, onNote, details, offers, soldOut, door, sending, error, onSignIn, under, onBack, onPlace }: Props) {
  const [typed, setTyped] = useState("");
  const q = offers?.quote;
  const empty = lines.length === 0;
  const phoneOk = !details || isPhone(details.phone);
  const ready = !empty && !soldOut && confirmed && phoneOk;
  const needPhone = !empty && !soldOut && !phoneOk;   // story 1574: the bar itself says what is missing and takes the customer there: phone first, then the map, then Place order
  const needMap = !empty && !soldOut && phoneOk && !confirmed;
  const [changing, setChanging] = useState(false);   // board BC1: Change turns the saved row into the field, in place
  const phoneRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.scrollIntoView?.({ block: "nearest" }); }, [error]);   // story 1580: a refusal below the fold, behind the floating bar, is not told to anyone
  useEffect(() => { if (changing) phoneRef.current?.focus(); }, [changing]);
  const savedRow = !!details?.saved && isPhone(details.saved) && details.phone === details.saved && !changing;
  const head = [kitchenName, pin].filter(Boolean).join(" · ");
  return (
    <>
      <header className="ui-head">
        <BackChevron label="Back to menu" onClick={onBack} />
        <h1>Your bill</h1>
        {under && <p role="status" className="ui-head-under">{under}</p>}
      </header>
      <div className="ui-scroll">
        <section className="ui-slip ui-slip-pad" aria-label={empty ? "Empty bill" : "Items"}>
          <TornTop />
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
                {lines.map(({ dish, qty, line_paise, was_paise, gone }) => soldOut?.id === dish.id || gone   /* story 1540: a dish the kitchen of this place does not make is struck like a sold-out one */
                  ? <div key={dish.id} style={{ color: "var(--gs-text-muted)", textDecoration: "line-through" }}><span>{qty} × {dish.name}</span><span>{plain(line_paise)}</span></div>
                  : <div key={dish.id}><span>{qty} × {dish.name}</span><span>{was_paise !== undefined && <s className="was">{plain(was_paise)}</s>}{plain(line_paise)}</span></div>)}   {/* story 1540: the price at the kitchen before, struck, on the same row */}
                <div><span>Delivery</span><span>{q && q.fees.delivery_paise > 0 ? plain(q.fees.delivery_paise) : "Free"}</span></div>
                {q && q.fees.packaging_paise > 0 && <div><span>Packaging</span><span>{plain(q.fees.packaging_paise)}</span></div>}
                {q && q.tax_mode === "exclusive" && q.tax_paise > 0 && <div><span>Tax</span><span>{plain(q.tax_paise)}</span></div>}
                {q && q.coupon && q.discount_paise - (q.swap_discount_paise ?? 0) > 0 && <div><span>Discount · {q.coupon.code}</span><span>−{plain(q.discount_paise - (q.swap_discount_paise ?? 0))}</span></div>}
                {q && (q.early_friend_paise ?? 0) > 0 && <div><span>Early friend gift</span><span>−{plain(q.early_friend_paise!)}</span></div>}
                {q && (q.swap_discount_paise ?? 0) > 0 && <div><span>Swap discount</span><span>−{plain(q.swap_discount_paise!)}</span></div>}
              </div>
            )}
            <div className="ui-slip-rule" />
            <div className={empty ? "ui-slip-total ui-muted" : "ui-slip-total"}><b>{q ? "To pay" : "To pay at door"}</b><span data-testid="bill-total">{formatRupees(total)}</span></div>
            {!empty && <button type="button" className="ui-btn ghost ui-add-more" onClick={onBack}>+ Add more</button>}
          </div>
        </section>
        {soldOut && soldOut.alt && soldOut.canSwap && <SwapSheet soldOut={soldOut} alt={soldOut.alt} />}
        {soldOut && !(soldOut.alt && soldOut.canSwap) && (   /* story 1706: no swap to offer (a dish the new kitchen does not make, or the quote not back yet): the old box with its one way out stays, as today */
          <div role="alert" className="ui-swap">
            <p className="ui-swap-reason">{soldOut.line ?? `${soldOut.name} is sold out.`}</p>
            <div className="ui-swap-actions"><button type="button" className="ui-btn ghost" onClick={soldOut.onRemove}>Take it out</button></div>
          </div>
        )}
        {offers && (offers.quote.offers.length > 0 || offers.quote.coupon) && (
          <section aria-label="Offers" style={{ margin: "16px 20px 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: "0 0 4px 0", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 400, color: "var(--gs-text-muted)" }}>Offers</h2>
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
          <form className="ui-form ph-no-capture" onSubmit={(e) => e.preventDefault()}>
            {details && (savedRow
              ? <div className="ui-phone-row"><span><small className="mono">The rider calls you on</small><span className="mono">{details.phone}</span></span><button type="button" className="ui-pinmap-change" onClick={() => setChanging(true)}>Change</button></div>   /* board BF2: ten digits together */
              : <div className="ui-field"><label htmlFor="phone">Phone number · the rider calls you on it</label><input ref={phoneRef} id="phone" className="mono-input ui-eg" type="tel" placeholder="10 digit number" value={details.phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" onChange={(e) => details.onPhone(e.target.value.replace(/\D/g, ""))} /></div>)}
            <PlaceRow words={address} onChange={onChangePlace} farKm={farKm} />
            <div className="ui-field"><label htmlFor="note">Note for the kitchen (optional)</label><textarea id="note" className="ui-eg" rows={2} value={note} maxLength={NOTE_MAX} placeholder="e.g. less spicy, no onion" onChange={(e) => onNote(e.target.value)} /><p className="mono ui-note-count"><span>{note.length} / {NOTE_MAX}</span></p></div>
            {door && (
              <fieldset className="ui-pay" role="radiogroup">
                <legend>How you pay · nothing is charged now</legend>
                {DOOR_METHODS.filter((m) => door.methods.includes(m.id)).map((m) => (
                  <label key={m.id} className="ui-pay-row"><input type="radio" name="pay" checked={door.value === m.id} onChange={() => door.onChange(m.id)} /><span><span>{m.label}</span>{m.sub && <small className="ui-pay-sub">{m.sub}</small>}</span></label>
                ))}
                {door.methods.length === 0 && <p className="ui-pay-sub">You pay at the door.</p>}
              </fieldset>
            )}
            {error && <p ref={errorRef} role="alert" className="ui-field-error" >{error}</p>}
            {error === SIGN_IN_LINE && onSignIn && <button type="button" className="ui-btn ghost" onClick={onSignIn}>Sign in</button>}
          </form>
        )}
      </div>
      {!empty && (
        <div className="ui-sticky float bill-foot">
          <button type="button" className="ui-btn bar" disabled={!(ready || needMap || needPhone) || sending} onClick={needPhone ? () => phoneRef.current?.focus() : needMap ? onConfirmPlace : onPlace}>
            <span className="mono">{door?.value === "upi_door" ? "UPI" : door?.value === "cash" ? "Cash" : "At door"} · {formatRupees(total)}</span><span className="verb">{sending ? "Placing…" : soldOut ? "Fix the bill first" : needPhone ? (details?.phone.trim() ? "Check your phone number ›" : "Add your phone number ›") : needMap ? "Confirm on the map ›" : "Place order ›"}</span>
          </button>
        </div>
      )}
    </>
  );
}
