// Story #976, board C2-AddressSheet, search by story #1036 (board C8-SearchResults): the Deliver to page. The saved addresses with their distance from the phone, a search, two ways to add one, and a small sheet to edit or remove.
import { useEffect, useRef, useState } from "react";
import { useBackCloses } from "../lib/back";
import { distanceM, distanceWord, lastUsed, NEAR_M, type Place, type SavedAddress } from "../lib/addresses";
import { splitMatch, type PlaceHit } from "../lib/placeSearch";
import { ClearCross, useSheetFit } from "../ui";

type Props = {
  focusSearch?: boolean;   // story #1133: the cursor starts in the search
  list: SavedAddress[]; selectedId: string | null; here: Place | null;
  search: (q: string) => Promise<PlaceHit[] | null>; onPlace: (hit: PlaceHit) => void;
  onBack: () => void; onSelect: (id: string) => void; onUseLocation: () => void; onAddNew: (words?: string) => void;
  onEditOnMap: (a: SavedAddress) => void; onRemove: (id: string) => Promise<void>;
};

const I = (d: React.ReactNode) => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const HOME = I(<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>);
const BRIEFCASE = I(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2" /></>);
const SEND = I(<path d="M21 3L3 11l7 3 3 7z" />);
const PIN = I(<><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>);
const UNDO_S = 6;
const SHORT = 3;
const iconFor = (label: string, near: boolean) => (near ? SEND : /home|ghar|nani|house/i.test(label) ? HOME : /office|work|shop/i.test(label) ? BRIEFCASE : PIN);

export function DeliverToScreen({ focusSearch, list, selectedId, here, search, onPlace, onBack, onSelect, onUseLocation, onAddNew, onEditOnMap, onRemove }: Props) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuFor, setMenuFor] = useState<SavedAddress | null>(null);
  const [all, setAll] = useState(false);   // board C12 and C13: three rows, then View all
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
  const rows = gone ? list.filter((a) => a.id !== gone.a.id) : list;
  const picked = gone && gone.a.id === selectedId ? lastUsed(rows)?.id ?? null : selectedId;   // board C10: the row that takes over carries Selected while Undo is open
  const q = query.trim().toLowerCase();
  const matches = q ? rows.filter((a) => `${a.label} ${a.address}`.toLowerCase().includes(q)) : rows;
  const shown = !q && !all && matches.length > SHORT ? matches.slice(0, SHORT) : matches;
  // Story #1036: typing only filters the saved rows. On submit one call asks our own table; any change of the words clears the places of the last search.
  const [found, setFound] = useState<{ words: string; state: "busy" | "short" | "error" | "ok"; hits: PlaceHit[] } | null>(null);
  const change = (v: string) => { setQuery(v); setFound(null); };
  const submit = async () => {
    const words = query.trim();
    if (words.length < 3) return setFound({ words, state: "short", hits: [] });
    setFound({ words, state: "busy", hits: [] });
    const hits = await search(words);
    setFound((cur) => (cur && cur.words === words ? { words, state: hits === null ? "error" : "ok", hits: hits ?? [] } : cur));
  };
  const bold = (text: string) => { const [a, m, b] = splitMatch(text, query.trim()); return m ? <>{a}<b>{m}</b>{b}</> : text; };
  return (
    <>
      <header className="ui-head">
        <button type="button" className="ui-back" aria-label="Back" onClick={onBack}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg></button>
        <h1>Deliver to</h1>
        <span className="meta">{rows.length} saved</span>
      </header>
      <div className="ui-scroll ui-deliver-to">
        <label className="ui-search-box">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input ref={searchRef} type="search" autoFocus={focusSearch} aria-label="Search an area or address" placeholder="Search an area or address" value={query} onChange={(e) => change(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} />
          <ClearCross show={query !== ""} onClear={() => change("")} input={searchRef} />
          <button type="button" className="ui-search-go" aria-label="Search places" onClick={() => void submit()}>{I(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>)}</button>
        </label>
        <div className="ui-two-cards">
          <button type="button" className="ui-card-btn" onClick={onUseLocation}>{I(<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>)}<span>Use current location</span></button>
          <button type="button" className="ui-card-btn" onClick={() => onAddNew()}>{I(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></>)}<span>Add new address</span></button>
        </div>
        {rows.length === 0 && !q ? (
          <section aria-label="Saved addresses" className="ui-saved-empty"><span className="ui-saved-empty-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg></span><h2>No saved address yet</h2></section>
        ) : (
        <section aria-label="Saved addresses">
          <h2 className="mono ui-saved-head">{q ? `Saved · ${matches.length} match` : "Saved addresses"}</h2>
          {q && matches.length === 0 && <button type="button" className="ui-row" onClick={() => onAddNew(query.trim())}><span className="ui-row-label"><span>Add new address</span><span className="ui-row-sub">{query.trim()}</span></span><span className="go" aria-hidden="true">›</span></button>}
          <div className="ui-saved-card">
          <ul className="ui-saved-list">
            {shown.map((a) => {
              const m = here && a.lat !== null && a.lng !== null ? distanceM(here, { lat: a.lat, lng: a.lng }) : null;
              const near = m !== null && m <= NEAR_M;
              return (
                <li key={a.id} className="ui-saved-row">
                  <span className="ui-chip-box" aria-hidden="true">{iconFor(a.label, near)}<span className="mono">{m === null ? "" : distanceWord(m, NEAR_M)}</span></span>
                  <button type="button" className="ui-saved-main" aria-label={`Deliver to ${a.label}`} onClick={() => onSelect(a.id)}>
                    <span className="ui-saved-label"><span>{bold(a.label)}</span>{a.id === picked && <span className="ui-tag ready">Selected</span>}</span>
                    <span className="ui-saved-addr">{bold(a.address)}</span>
                  </button>
                  <button type="button" className="ui-btn ghost icon" aria-label={`Edit or remove ${a.label}`} onClick={() => setMenuFor(a)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg></button>
                </li>
              );
            })}
          </ul>
          {!q && !all && matches.length > SHORT && <button type="button" className="ui-view-all" onClick={() => setAll(true)}>View all <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>}
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
              {found.hits.map((h) => (
                <li key={`${h.pin}-${h.name}`} className="ui-saved-row ui-place-row">
                  <button type="button" className="ui-saved-main" onClick={() => onPlace(h)}>
                    <span className="ui-saved-label"><span>{bold(h.name)}</span><span className={`ui-tag ${h.served ? "ready" : "placed"}`}>{h.served ? "We deliver here" : "Not yet"}</span></span>
                    <span className="ui-saved-addr">{h.address}</span>
                  </button>
                </li>
              ))}
            </ul>
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
