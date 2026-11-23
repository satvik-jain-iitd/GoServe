// Story #588: asks POST /quote while the Bill is open (story 1771: and on the menu with a dish in the cart, after `wait` ms) and keeps the offers, the applied code and the line for a code that is not valid.
import { useEffect, useRef, useState } from "react";
import { askFor, fetchQuote, type Alternative, type Quote } from "./quote";

export function useOffers(on: boolean, kitchenId: string | null, pin: string | null, items: { menu_item_id: string; qty: number; swap?: boolean }[], off = false, wait = 0, feeAsOf: string | null = null) {   // story 1775: feeAsOf is the time of the fee this app loaded; null sends none   // off: the offers are not shown, so no coupon is asked for (story #995)
  const key = JSON.stringify(items);
  const [pick, setPick] = useState<{ key: string; code: string | null; none: boolean }>({ key, code: null, none: false });   // code null: the server picks the best; none: Remove (story #597)
  const { code, none } = askFor(off, pick.key === key ? pick : { code: null, none: false });   // a change in the cart clears the pick
  const cart = JSON.stringify({ kitchenId, pin, key });   // story 1771: an answer is for this cart (kitchen, place, dishes and counts) and is shown only for it
  const [got, setGot] = useState<{ cart: string; quote: Quote } | null>(null);
  const quote = got && got.cart === cart ? got.quote : null;
  const [failed, setFailed] = useState<string | null>(null);   // story 1775: the cart whose last quote call got no price
  const [kind, setKind] = useState<"offline" | "server" | null>(null);   // story 1766: why there is no price: the call did not reach us (offline) or the server gave none (server)
  const [codeError, setCodeError] = useState<string | null>(null);
  const [alt, setAlt] = useState<Alternative | null | undefined>(undefined);   // story #619: the server's alternative for the first sold-out dish; null none, undefined not asked or not sold out
  const asOf = useRef(feeAsOf); asOf.current = feeAsOf;   // story 1775: read when the call goes out; a re-read of the fee after a 409 does not ask again, the next call carries it
  const again = useRef<(() => void) | null>(null);
  const due = useRef<(() => void) | null>(null);   // story 1771: the call that waits for its 300 ms; the Bill opening runs it at once
  useEffect(() => {
    if (!on || !kitchenId || !pin || items.length === 0) { setGot(null); return; }
    let live = true;
    const run = () => {
      clearTimeout(timer); due.current = null;
      void fetchQuote({ kitchenId, pin, items, code, none, feeAsOf: asOf.current }).then((r) => {
        if (!live) return;
        setFailed(r.ok ? null : cart);
        setKind(r.ok ? null : r.error === "network" ? "offline" : r.error === "unavailable" ? "server" : null);
        if (r.ok) { setGot({ cart, quote: r.quote }); setAlt(undefined); }
        else if (r.error === "dish_sold_out") { setGot(null); setAlt(r.alternative ?? null); }
        else if (r.error === "coupon_invalid" && code) { setCodeError(r.message); setPick({ key, code: null, none: false }); }   // the bill stays; the quote is asked again without the code
        else setGot(null);
      });
    };
    const timer = setTimeout(run, wait);   // a newer cart clears this timer, so fast taps send one call
    due.current = run;
    again.current = () => { setFailed(null); setKind(null); run(); };   // story 1766: Try again asks at once, with no new effect dependency
    return () => { live = false; clearTimeout(timer); due.current = null; again.current = null; };
  }, [on, kitchenId, pin, key, code, none]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (wait === 0) due.current?.(); }, [wait]);
  const failure = failed === cart && !quote ? kind : null;   // story 1766: the Bill says so only when the price could not be had, never for a sold-out dish or a bad code
  useEffect(() => {   // the phone is back online: ask again, so the Bill heals without a tap
    if (!failure) return;
    const back = () => again.current?.();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [failure]);
  const loading = on && !!kitchenId && !!pin && items.length > 0 && !quote && failed !== cart;   // story 1775: a call is waiting or in flight for this cart; the Bill draws grey bars, not a sum it cannot know
  return {
    quote, loading, failure, retry: () => again.current?.(), codeError, code, none, alt,
    replace: (q: Quote) => setGot({ cart, quote: q }),   // story #590: the order came back with a new price
    apply: (c: string) => { setCodeError(null); setPick({ key, code: c.trim().toUpperCase(), none: false }); },
    remove: () => { setCodeError(null); setPick({ key, code: null, none: true }); },
  };
}
