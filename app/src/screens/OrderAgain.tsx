// Story 1589, frame history-1 (owner picked): the "Order it again" block under a delivered slip, and its one filled button in the foot (rule 8).
// Four states keep every box where it is (rule 23): all, some, none made today, and the kitchen closed. The line and the note under the button always keep their room.
import { formatRupees } from "../lib/money";
import type { AgainRow } from "../lib/cart";

export type Again = { kitchen: string; rows: AgainRow[]; marks: "loading" | "failed" | "ready"; closed: boolean };
const made = (a: Again) => a.rows.filter((r) => r.made);
const none = (a: Again) => a.marks === "failed" || (a.marks === "ready" && made(a).length === 0);

export function AgainBlock({ a }: { a: Again }) {
  const line = a.marks === "failed" ? "Could not check today's menu." : none(a) ? `${a.kitchen || "The kitchen"} does not make these dishes today.` : a.marks === "loading" ? "" : `${a.kitchen || "The kitchen"} cooks for you today.`;
  return (
    <section className="ui-again" aria-label="Order it again">
      <h2>Order it again</h2>
      <p className="ui-again-line">{line}</p>
      <ul className="ui-again-list">
        {a.rows.map((r, i) => {
          const known = a.marks === "ready";
          return (
            <li key={i} className={`ui-again-dish${known && !r.made ? " no" : ""}`}>
              <span className="ui-again-mk" aria-hidden="true">{known ? (r.made ? "✓" : "✕") : ""}</span>
              <span className="nm">{r.name}</span>
              <span className="r">{known ? (r.made ? formatRupees(r.paise) : r.soldOut ? "sold out today" : "not made today") : ""}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// The button: left "1 of 2 · ₹180" (the count only when not all), right "Order again ›". Nothing made, or the menu unread: no Order again, the button is "See the menu".
export function AgainBar({ a, onAgain, onMenu }: { a: Again; onAgain: () => void; onMenu: () => void }) {
  const ok = made(a);
  const total = formatRupees(ok.reduce((n, r) => n + r.paise, 0));
  const left = a.marks !== "ready" || none(a) ? "" : ok.length === a.rows.length ? total : `${ok.length} of ${a.rows.length} · ${total}`;
  const asMenu = none(a);
  return (
    <>
      <button type="button" className="ui-btn bar big" disabled={!asMenu && (a.marks === "loading" || a.closed)} onClick={asMenu ? onMenu : onAgain}>
        <span className="mono">{left}</span><span className="verb">{asMenu ? "See the menu" : "Order again ›"}</span>
      </button>
      <p className="ui-again-note" role="status">{!asMenu && a.closed ? `${a.kitchen || "The kitchen"} is closed now.` : ""}</p>
    </>
  );
}
