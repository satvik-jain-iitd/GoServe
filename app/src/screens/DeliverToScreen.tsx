// Story #976, board C2-AddressSheet, search by story #1036 (board C8-SearchResults): the Deliver to page. The saved addresses with their distance from the phone, a search, two ways to add one, and a small sheet to edit or remove.
import { useEffect, useRef, useState } from "react";
import { useBackCloses } from "../lib/back";
import { distanceM, distanceWord, hasPoint, hereRow, lastUsed, type Place, type SavedAddress, type Spot } from "../lib/addresses";
import type { Recent } from "../lib/recents";
import { locWords, type LocWhy } from "../lib/locate";
import { fromOla, splitMatch, usePlaces, type PlaceHit, type Search } from "../lib/placeSearch";
import { ClearCross, useSheetFit } from "../ui";

type Props = {
  focusSearch?: boolean;   // story #1133: the cursor starts in the search
  list: SavedAddress[]; selectedId: string | null; here: Spot | null; near: number;   // story 1608: near = the setting address_near_m, the same one the pick on open uses
  recents: Recent[]; recentId: string | null; onRecent: (r: Recent) => void;   // story 1530 (board LF4b): "Recently searched", the one that is the place now, and a tap on one
  forMap?: Place;   // story 1530 (board LF13): the search was opened from the pin map's bar, with the pin at this point. Places are asked near it; Back (the arrow and the phone's) shows the map again
  search: Search; onPlace: (hit: PlaceHit, typed: string) => void;
  onBack?: () => void;   // story 1529: none when there is no place at all (no menu to go back to); the arrow's space is kept
  current: string | null;   // story 1529, boards LF5 and LF2: the place is "Where you are now"; these are its words. null: a saved address, or no place
  why: LocWhy | null; finding: boolean;   // bug 1526: why the phone was not found (the box says the true line), and a tap's find is running
  onSelect: (id: string) => void; onUseLocation: () => void; onAddNew: (words?: string) => void;
  onEditOnMap: (a: SavedAddress) => void; onRemove: (id: string) => Promise<void>;
};

const I = (d: React.ReactNode) => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const HOME = I(<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>);
const BRIEFCASE = I(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2" /></>);
const SEND = I(<path d="M21 3L3 11l7 3 3 7z" />);
const OFF = I(<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /><path d="M3 3l18 18" /></>);
const PIN = I(<><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>);
const CLOCK = I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const LOCATE = I(<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>);   // story 1548: the same icon on the box "Where should we deliver?"
const DOWN = <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>;
const UNDO_S = 6;
const SHORT = 2;   // story 1608: two rows, then View all
const iconFor = (label: string, near: boolean) => (near ? SEND : /home|ghar|nani|house/i.test(label) ? HOME : /office|work|shop/i.test(label) ? BRIEFCASE : PIN);

export function DeliverToScreen({ focusSearch, forMap, list, recents, recentId, onRecent, selectedId, here, near, current, why, finding, search, onPlace, onBack, onSelect, onUseLocation, onAddNew, onEditOnMap, onRemove }: Props) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuFor, setMenuFor] = useState<SavedAddress | null>(null);
  const [all, setAll] = useState(false);   // board C12 and C13: two rows (story 1608), then View all
  const [allRecent, setAllRecent] = useState(false);
  useBackCloses(!!forMap, () => onBack?.());
  // Story #1051 (board C10): a removed row leaves the list at once; the delete itself waits UNDO_S seconds so Undo can bring it back. Leaving the page does not lose it.
  const [gone, setGone] = useState<{ a: SavedAddress; left: number } | null>(null);
  const goneRef = useRef(gone);
  goneRef.current = gone;
  const removeRef = useRef(onRemove);
  removeRef.current = onRemove;
  useEffect(() => {
    if (!gone) return;
    const id = setInterval(() => setGone((g) => (g ? { ...g, left: g.left - 1 } : g)), 1000);
    return () => clearInterval(id);
  }, [gone?.a.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (gone && gone.left <= 0) { void removeRef.current(gone.a.id); setGone(null); } }, [gone]);
  useEffect(() => () => { if (goneRef.current) void removeRef.current(goneRef.current.a.id); }, []);
  const take = (a: SavedAddress) => { if (goneRef.current) void removeRef.current(goneRef.current.a.id); setGone({ a, left: UNDO_S }); };
  const left = gone ? list.filter((a) => a.id !== gone.a.id) : list;
  // Story 1608: one row is "here" (the mark follows the phone). That row is first, then last used, as the list comes. The order is set when the screen opens and
  // when a tap on "Use current location" has found the phone; it does not jump while the list is open (owner's rule 23).
  const hereId = here ? hereRow(left, here, near)?.id ?? null : null;
  const [first, setFirst] = useState(hereId);
  const [wasFinding, setWasFinding] = useState(finding);
  if (wasFinding !== finding) { setWasFinding(finding); if (!finding) setFirst(hereId); }
  if (first === null && hereId !== null) setFirst(hereId);   // the here row is never hidden: found after the screen opened, nothing was here before, so nothing jumps away
  const rows = [...left.filter((a) => a.id === first), ...left.filter((a) => a.id !== first)];
  const picked = gone && gone.a.id === selectedId ? lastUsed(rows)?.id ?? null : selectedId;   // board C10: the row that takes over carries Selected while Undo is open
  const q = query.trim().toLowerCase();
  const matches = q ? rows.filter((a) => `${a.label} ${a.address}`.toLowerCase().includes(q)) : rows;
  const shown = !q && !all && matches.length > SHORT ? matches.slice(0, SHORT) : matches;
  const recentHits = q ? recents.filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(q)) : recents;   // typing filters the recents like the saved rows
  const recentShown = !q && !allRecent && recentHits.length > SHORT ? recentHits.slice(0, SHORT) : recentHits;
  // Story 1036, changed by 1519: typing filters the saved rows and, after 3 letters and a pause, asks for places near the phone. Enter asks at once (story 1530: the arrow button is gone).
  const { found, ask: submit } = usePlaces(query, search, forMap ?? here);
  // Story 1529 (owner's pick, Way 2): no box when the place is a saved address (its row says Selected). The box shows the place that is not a saved one, or why the phone was not found.
  const fault = why ? locWords(why, "search above") : null;
  const going = fault ? { ...fault, sub: why === "denied" || why === "still" ? "Turn it on in settings, or search above." : fault.sub, here: false } : current ? { title: "Where you are now", sub: current, here: true } : null;   // story 1734: the short line for the two blocked messages, on this card only (the sheet keeps its own words)
  const bold = (text: string) => { const [a, m, b] = splitMatch(text, query.trim()); return m ? <>{a}<b>{m}</b>{b}</> : text; };
  return (
    <>
      <header className="ui-head">
        {onBack ? <button type="button" className="ui-back" aria-label="Back" onClick={onBack}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg></button> : <span className="ui-back" aria-hidden="true" />}
        <h1>Serving at</h1>
        <span className="meta">{rows.length} saved</span>
      </header>
      <div className="ui-scroll ui-deliver-to">
        <label className="ui-search-box">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input ref={searchRef} type="search" autoFocus={focusSearch} aria-label="Search an area or address" placeholder="Search an area or address" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
          <ClearCross show={query !== ""} onClear={() => setQuery("")} input={searchRef} />
        </label>
        {!q && <div className="ui-two-cards">
          <button type="button" className="ui-card-btn" disabled={finding} onClick={onUseLocation}>{LOCATE}<span>{finding ? "Finding you…" : "Use current location"}</span></button>
          <button type="button" className="ui-card-btn" onClick={() => onAddNew()}>{I(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></>)}<span>Add new address</span></button>
        </div>}   {/* board LF13: while the customer types only the results show */}
        {going && !q && (
          <section aria-label="Serving at" className={going.here ? "ui-going here" : "ui-going"}>
            <div>{going.here ? PIN : OFF}<span className="ui-going-words"><span className="ui-going-title"><span className="ui-going-t">{going.title}</span>{going.here && <span className="ui-tag ready">Selected</span>}</span><span className="ui-going-sub">{going.sub}</span></span></div>
          </section>
        )}
        {rows.length === 0 && !q ? (
          <section aria-label="Saved addresses" className="ui-saved-empty"><span className="ui-saved-empty-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg></span><h2>No saved address yet</h2></section>
        ) : (
        <section aria-label="Saved addresses">
          <h2 className="mono ui-saved-head">{q ? `Saved · ${matches.length} match` : "Saved addresses"}</h2>
          {q && matches.length === 0 && <button type="button" className="ui-row" onClick={() => onAddNew(query.trim())}><span className="ui-row-label"><span>Add new address</span><span className="ui-row-sub">{query.trim()}</span></span><span className="go" aria-hidden="true">›</span></button>}
          <div className="ui-saved-card">
          <ul className="ui-saved-list">
            {shown.map((a) => {
              const isHere = a.id === hereId;
              const pinned = hasPoint(a);   // board LF11: an old row with no pin cannot be picked; the tap sets its pin
              return (
                <li key={a.id} className={pinned ? "ui-saved-row" : "ui-saved-row unpinned"}>
                  <span className="ui-chip-box" aria-hidden="true">{iconFor(a.label, isHere)}<span className="mono">{isHere ? "here" : here && hasPoint(a) ? distanceWord(distanceM(here, a)) : ""}</span></span>
                  <button type="button" className="ui-saved-main" aria-label={pinned ? `Serve at ${a.label}` : `${a.label} has no pin. Set the pin`} onClick={() => onSelect(a.id)}>
                    <span className="ui-saved-label"><span>{bold(a.label)}</span>{a.id === picked && !going?.here && <span className="ui-tag ready">Selected</span>}</span>
                    <span className="ui-saved-addr">{pinned ? bold(a.address) : "Set the pin"}</span>
                  </button>
                  <button type="button" className="ui-btn ghost icon" aria-label={`Edit or remove ${a.label}`} onClick={() => setMenuFor(a)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg></button>
                </li>
              );
            })}
          </ul>
          {!q && !all && matches.length > SHORT && <button type="button" className="ui-view-all" onClick={() => setAll(true)}>View all {DOWN}</button>}
          </div>
        </section>
        )}
        {recentHits.length > 0 && (   // story 1530 (board LF4b, owner: "same saved address jesa karo"): the saved card and rows; a clock, no label tag, no three-dot menu
          <section aria-label="Recently searched">
            <h2 className="mono ui-saved-head">Recently searched</h2>
            <div className="ui-saved-card">
              <ul className="ui-saved-list">
                {recentShown.map((r) => (
                  <li key={r.id} className="ui-saved-row">
                    <span className="ui-chip-box" aria-hidden="true">{CLOCK}<span className="mono">{here ? distanceWord(distanceM(here, r)) : ""}</span></span>
                    <button type="button" className="ui-saved-main" aria-label={`Serve at ${r.name}`} onClick={() => onRecent(r)}>
                      <span className="ui-saved-label"><span>{bold(r.name)}</span>{r.id === recentId && !going?.here && <span className="ui-tag ready">Selected</span>}</span>
                      <span className="ui-saved-addr">{bold(r.address)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!q && !allRecent && recentHits.length > SHORT && <button type="button" className="ui-view-all" aria-label="View all recent searches" onClick={() => setAllRecent(true)}>View all {DOWN}</button>}
            </div>
          </section>
        )}
        {found && (
          <section aria-label="Places">
            {found.state === "busy" && <p className="mono ui-saved-head">Searching…</p>}
            {found.state === "short" && <p className="ui-field-error" role="alert">Type at least 3 letters to search places.</p>}
            {found.state === "error" && <p className="ui-field-error" role="alert">Could not search places. Try again.</p>}
            {found.state === "ok" && <h2 className="mono ui-saved-head">{found.hits.length ? `Places · ${found.hits.length} found` : "Places · 0 found"}</h2>}
            {found.state === "ok" && found.hits.length === 0 && <p className="ui-row-sub">No place found. Try the start of a colony name or a pin code.</p>}
            <ul className="ui-saved-list">
              {found.hits.map((h, i) => (
                <li key={`${i}-${h.name}`} className="ui-saved-row ui-place-row">
                  <button type="button" className="ui-saved-main" onClick={() => onPlace(h, query.trim())}>
                    <span className="ui-saved-label"><span>{bold(h.name)}</span><span className={`ui-tag ${h.served ? "ready" : "placed"}`}>{h.served ? "We deliver here" : "Not yet"}</span></span>
                    <span className="ui-saved-addr">{h.address}</span>
                  </button>
                </li>
              ))}
            </ul>
            {fromOla(found.hits) && <span className="mono ui-pinmap-credit"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Ola Maps</a></span>}
          </section>
        )}
      </div>
      {gone && <div role="status" className="ui-undo-bar"><span>{gone.a.label} removed</span><span className="mono">{gone.left} sec</span><button type="button" onClick={() => setGone(null)}>Undo</button></div>}
      {menuFor && <MenuSheet a={menuFor} onClose={() => setMenuFor(null)} onEdit={() => { const a = menuFor; setMenuFor(null); onEditOnMap(a); }} onRemove={() => { const a = menuFor; setMenuFor(null); take(a); }} />}
    </>
  );
}

function MenuSheet({ a, onClose, onEdit, onRemove }: { a: SavedAddress; onClose: () => void; onEdit: () => void; onRemove: () => void }) {
  useBackCloses(true, onClose);   // story 1415
  const fit = useSheetFit();
  return (
    <div ref={fit} className="ui-sheet-back" onClick={onClose}>
      <section className="ui-sheet" role="dialog" aria-modal="true" aria-label={`${a.label}, edit or remove`} onClick={(e) => e.stopPropagation()}>
        <div className="ui-sheet-head"><h2>{a.label}</h2></div>
        <button type="button" className="ui-btn ghost big" onClick={onEdit}>Edit</button>
        <button type="button" className="ui-btn ghost big" onClick={onRemove}>Remove</button>
      </section>
    </div>
  );
}
