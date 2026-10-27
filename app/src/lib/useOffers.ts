// Story #588: asks POST /quote while the Bill is open and keeps the offers, the applied code and the line for a code that is not valid.
import { useEffect, useState } from "react";
import { fetchQuote, type Quote } from "./quote";

export function useOffers(on: boolean, kitchenId: string | null, pin: string | null, items: { menu_item_id: string; qty: number }[]) {
  const [code, setCode] = useState<string | null>(null);   // null: the server picks the best
  const [quote, setQuote] = useState<Quote | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const key = JSON.stringify(items);
  useEffect(() => {
    if (!on || !kitchenId || !pin || items.length === 0) { setQuote(null); return; }
    let live = true;
    void fetchQuote({ kitchenId, pin, items, code }).then((r) => {
      if (!live) return;
      if (r.ok) setQuote(r.quote);
      else if (r.error === "coupon_invalid" && code) { setCodeError(r.message); setCode(null); }   // the bill stays; the quote is asked again without the code
      else setQuote(null);
    });
    return () => { live = false; };
  }, [on, kitchenId, pin, key, code]);   // eslint-disable-line react-hooks/exhaustive-deps
  return { quote, codeError, apply: (c: string) => { setCodeError(null); setCode(c.trim().toUpperCase()); } };
}
