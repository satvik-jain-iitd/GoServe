// Story 1548 (owner, 15 Nov 2026): the phone is far from every saved address and every place this customer confirmed before. One box over the menu asks where the food goes.
// It must be answered: no close button, no tap outside, no Escape, no Back step of its own. The same box for every customer: it names no address.
// The outline button is above and the filled one is last. The line under it keeps its space, so the box has one height when we deliver there and when we do not.
import { LOCATE } from "./DeliverToScreen";
import { useSheetFit } from "../ui";

const LIST = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>;

export function WhereToDeliver({ served, onOther, onCurrent }: { served: boolean; onOther: () => void; onCurrent: () => void }) {
  const fit = useSheetFit();
  return (
    <div ref={fit} className="ui-sheet-back">
      <section className="ui-sheet ui-locoff" role="dialog" aria-modal="true" aria-label="Where should we deliver?">
        <h2>Where should we deliver?</h2>
        <button type="button" className="ui-btn ghost big" onClick={onOther}>{LIST}Use another address</button>
        <button type="button" className="ui-btn big" disabled={!served} aria-describedby="where-not" onClick={onCurrent}>{LOCATE}Use current location</button>
        <p id="where-not" className="ui-where-not" role="status">{served ? "" : "We do not deliver here yet"}</p>
      </section>
    </div>
  );
}
