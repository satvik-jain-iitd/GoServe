// Story #1227, board CX1-CancelSheet (owner, 11 Nov 2026): Cancel order asks first. Only the red button cancels. Keep my order, Close, Escape and a tap outside keep the order.
import { useEffect, useRef } from "react";

type Props = { lines: { name: string; qty: number }[]; kitchenName: string; paidOnline: boolean; onKeep: () => void; onYes: () => void };

export function CancelSheet({ lines, kitchenName, paidOnline, onKeep, onYes }: Props) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keep.current?.focus();   // the safe answer has the focus
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onKeep(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onKeep]);
  const dishes = lines.map((l) => `${l.qty} × ${l.name}`).join(" and ");
  return (
    <div className="ui-sheet-back" onClick={onKeep}>
      <section className="ui-sheet" role="dialog" aria-modal="true" aria-label="Cancel this order?" onClick={(e) => e.stopPropagation()}>
        <div className="ui-sheet-head">
          <h2>Cancel this order?</h2>
          <button type="button" className="ui-btn ghost icon" aria-label="Close" onClick={onKeep}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p className="ui-sheet-lead">The kitchen has not started cooking. You can still cancel.</p>
        <dl className="ui-cancel-rows">
          <div><dt className="mono">Stops</dt><dd>{dishes} from {kitchenName}. No rider comes.</dd></div>
          <div><dt className="mono">You pay</dt><dd>{paidOnline ? "If you paid online, it comes back in 5 to 7 days." : "Nothing. You pay at the door, so nothing is charged now."}</dd></div>
          <div><dt className="mono">After</dt><dd>To eat, you place a new order. The time starts again.</dd></div>
        </dl>
        <div className="ui-sheet-acts">
          <button type="button" className="ui-btn big danger-fill" onClick={onYes}>Yes, cancel the order</button>
          <button ref={keep} type="button" className="ui-btn ghost big" onClick={onKeep}>Keep my order</button>
        </div>
      </section>
    </div>
  );
}
