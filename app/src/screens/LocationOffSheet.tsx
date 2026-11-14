// Story #1056 (board SW3), rebuilt by bug 1526 (boards LO-V1, LF-SHEET-Blocked, LF-SHEET-Busy): the phone was not found on open. A sheet over the menu, once per app open:
// "Where to bring your food?". The place stays until the customer chooses another here. The line is true for the cause, the filled button is last and it works:
// after a find that failed (any cause), asking again is the outline button and search is the filled one. A tap on the find button always asks again and says "Finding you…".
import { useEffect } from "react";
import { useBackCloses } from "../lib/back";
import type { SavedAddress } from "../lib/addresses";
import { locWords, type LocWhy } from "../lib/locate";
import { useSheetFit } from "../ui";

type Props = { list: SavedAddress[]; selectedId: string | null; why: LocWhy; busy: boolean; onFind: () => void; onPick: (a: SavedAddress) => void; onViewAll: () => void; onSearch: () => void; onClose: () => void };

const HOME = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
const TICK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>;

export function LocationOffSheet({ list, selectedId, why, busy, onFind, onPick, onViewAll, onSearch, onClose }: Props) {
  useBackCloses(true, onClose);   // story 1415
  const fit = useSheetFit();
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  const failed = why !== "ask";   // story 1530: one rule with the first-open screen. A find that failed, for any cause: search is the filled, last button and the retry is the outline above it
  const words = locWords(why, "");
  const find = (kind: string, label: string) => <button type="button" className={`ui-btn ${kind}big`} disabled={busy} onClick={onFind}>{busy ? "Finding you…" : label}</button>;
  const search = (kind: string) => <button type="button" className={`ui-btn ${kind}big`} onClick={onSearch}>Search your area</button>;
  return (
    <div ref={fit} className="ui-sheet-back" onClick={onClose}>
      <section className="ui-sheet ui-locoff" role="dialog" aria-modal="true" aria-label="Where to bring your food?" onClick={(e) => e.stopPropagation()}>
        <h2>Where to bring your food?</h2>
        <p className="ui-locoff-how" role="status">{words.title}. {why === "still" ? words.sub : "Pick a place."}</p>
        {list.length > 0 && (
          <>
            <div className="ui-locoff-rows">
              {list.slice(0, 2).map((a) => {
                const pinned = a.lat !== null && a.lng !== null;
                return (
                  <button key={a.id} type="button" className="ui-locoff-row" aria-current={a.id === selectedId || undefined} aria-label={pinned ? undefined : `${a.label} has no pin. Set the pin`} onClick={() => onPick(a)}>
                    <span className="ui-locoff-home">{HOME}</span>
                    <span className="ui-locrow-words"><span className="ui-locrow-title">{a.label}</span><span className="ui-locrow-sub">{pinned ? `${a.address} ${a.pin}` : "Set the pin"}</span></span>
                    <span className="ui-locrow-go" aria-hidden="true">{a.id === selectedId ? TICK : "›"}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="ui-locoff-all" onClick={onViewAll}>View all</button>
          </>
        )}
        {failed ? find("ghost ", "Try location again") : search("ghost ")}
        {failed ? search("") : find("", "Use my current location")}
      </section>
    </div>
  );
}
