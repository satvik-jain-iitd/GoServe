// Story #1056 (board SW3): the phone's location is off. A sheet over the menu, once per app open. The auto-picked address stays until the customer chooses another here.
import { useEffect } from "react";
import { useBackCloses } from "../lib/back";
import type { SavedAddress } from "../lib/addresses";
import { useSheetFit } from "../ui";

type Props = { list: SavedAddress[]; denied: boolean; busy: boolean; onTurnOn: () => void; onPick: (a: SavedAddress) => void; onViewAll: () => void; onSearch: () => void; onClose: () => void };

const OFF = <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /><path d="M3 3l18 18" /></svg>;
const HOME = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;

export function LocationOffSheet({ list, denied, busy, onTurnOn, onPick, onViewAll, onSearch, onClose }: Props) {
  useBackCloses(true, onClose);   // story 1415
  const fit = useSheetFit();
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div ref={fit} className="ui-sheet-back" onClick={onClose}>
      <section className="ui-sheet ui-locoff" role="dialog" aria-modal="true" aria-label="Location is off" onClick={(e) => e.stopPropagation()}>
        <span className="ui-locoff-icon">{OFF}</span>
        <h2>Location is off</h2>
        {denied && <p className="ui-locoff-how" role="status">Location is blocked for this app. Turn it on in your phone settings, then come back.</p>}
        <button type="button" className="ui-btn big" disabled={busy} onClick={onTurnOn}>Turn on location</button>
        {list.length > 0 && (
          <>
            <div className="ui-locoff-head"><span className="ui-locrow-label">Your addresses</span><button type="button" className="ui-locoff-all" onClick={onViewAll}>View all</button></div>
            {list.slice(0, 2).map((a) => (
              <button key={a.id} type="button" className="ui-locoff-row" onClick={() => onPick(a)}>
                <span className="ui-locoff-home">{HOME}</span>
                <span className="ui-locrow-words"><span className="ui-locrow-title">{a.label}</span><span className="ui-locrow-sub">{a.address} {a.pin}</span></span>
                <span className="ui-locrow-go" aria-hidden="true">›</span>
              </button>
            ))}
          </>
        )}
        <button type="button" className="ui-btn ghost big" onClick={onSearch}>Search your area</button>
      </section>
    </div>
  );
}
