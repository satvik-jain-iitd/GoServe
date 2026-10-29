// Story #588: asks POST /quote while the Bill is open and keeps the offers, the applied code and the line for a code that is not valid.
import { useEffect, useState } from "react";
import { fetchQuote, type Quote } from "./quote";

export function useOffers(on: boolean, kitchenId: string | null, pin: string | null, items: { menu_item_id: string; qty: number }[]) {
  const key = JSON.stringify(items);
  const [pick, setPick] = useState<{ key: string; code: string | null; none: boolean }>({ key, code: null, none: false });   // code null: the server picks the best; none: Remove (story #597)
  const { code, none } = pick.key === key ? pick : { code: null, none: false };   // a change in the cart clears the pick
  const [quote, setQuote] = useState<Quote | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  useEffect(() => {
    if (!on || !kitchenId || !pin || items.length === 0) { setQuote(null); return; }
    let live = true;
    void fetchQuote({ kitchenId, pin, items, code, none }).then((r) => {
      if (!live) return;
      if (r.ok) setQuote(r.quote);
      else if (r.error === "coupon_invalid" && code) { setCodeError(r.message); setPick({ key, code: null, none: false }); }   // the bill stays; the quote is asked again without the code
      else setQuote(null);
    });
    return () => { live = false; };
  }, [on, kitchenId, pin, key, code, none]);   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    quote, codeError,
    apply: (c: string) => { setCodeError(null); setPick({ key, code: c.trim().toUpperCase(), none: false }); },
    remove: () => { setCodeError(null); setPick({ key, code: null, none: true }); },
  };
}
