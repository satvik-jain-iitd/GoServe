// Story #976, board C2-AddressSheet: the Deliver to page. The saved addresses with their distance from the phone, a search, two ways to add one, and a small sheet to edit or remove.
import { useState } from "react";
import { distanceM, distanceWord, type Place, type SavedAddress } from "../lib/addresses";
import { isPin } from "../lib/area";
import { useSheetFit } from "../ui";

type Props = {
  list: SavedAddress[]; selectedId: string | null; here: Place | null; nearM: number;
  onBack: () => void; onSelect: (id: string) => void; onUseLocation: () => void; onAddNew: (words?: string) => void;
  onEdit: (id: string, a: { label: string; address: string; pin: string }) => Promise<boolean>; onRemove: (id: string) => Promise<void>;
};

const I = (d: React.ReactNode) => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const HOME = I(<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>);
const BRIEFCASE = I(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2" /></>);
const SEND = I(<path d="M21 3L3 11l7 3 3 7z" />);
const PIN = I(<><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>);
const iconFor = (label: string, near: boolean) => (near ? SEND : /home|ghar|nani|house/i.test(label) ? HOME : /office|work|shop/i.test(label) ? BRIEFCASE : PIN);

export function DeliverToScreen({ list, selectedId, here, nearM, onBack, onSelect, onUseLocation, onAddNew, onEdit, onRemove }: Props) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<SavedAddress | null>(null);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const q = query.trim().toLowerCase();
  const shown = q ? list.filter((a) => `${a.label} ${a.address}`.toLowerCase().includes(q)) : list;
  return (
    <>
      <header className="ui-head">
        <button type="button" className="ui-back" aria-label="Back" onClick={onBack}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
        <h1>Deliver to</h1>
        <span className="meta">{list.length} saved</span>
      </header>
      <div className="ui-scroll ui-deliver-to">
        <label className="ui-search-box">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" aria-label="Search an area or address" placeholder="Search an area or address" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="ui-two-cards">
          <button type="button" className="ui-card-btn" onClick={onUseLocation}>{I(<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>)}<span>Use current location</span></button>
          <button type="button" className="ui-card-btn" onClick={() => onAddNew()}>{I(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></>)}<span>Add new address</span></button>
        </div>
        <section aria-label="Saved addresses">
          <h2 className="mono ui-saved-head">Saved addresses</h2>
          {q && shown.length === 0 && <button type="button" className="ui-row" onClick={() => onAddNew(query.trim())}><span className="ui-row-label"><span>Add new address</span><span className="ui-row-sub">{query.trim()}</span></span><span className="go" aria-hidden="true">›</span></button>}
          <ul className="ui-saved-list">
            {shown.map((a) => {
              const m = here && a.lat !== null && a.lng !== null ? distanceM(here, { lat: a.lat, lng: a.lng }) : null;
              const near = m !== null && m <= nearM;
              return (
                <li key={a.id} className="ui-saved-row">
                  <span className="ui-chip-box" aria-hidden="true">{iconFor(a.label, near)}<span className="mono">{m === null ? "" : distanceWord(m, nearM)}</span></span>
                  <button type="button" className="ui-saved-main" aria-label={`Deliver to ${a.label}`} onClick={() => onSelect(a.id)}>
                    <span className="ui-saved-label">{a.label}{a.id === selectedId && <span className="ui-tag ready">Selected</span>}</span>
                    <span className="ui-saved-addr">{a.address}</span>
                  </button>
                  <button type="button" className="ui-btn ghost icon" aria-label={`Edit or remove ${a.label}`} onClick={() => setMenuFor(a)}>{I(<><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></>)}</button>
                </li>
              );
            })}
          </ul>
        </section>
        <p className="mono ui-deliver-foot">The one nearest you is picked when the app opens. Far from all of them, the app asks.</p>
      </div>
      {menuFor && <MenuSheet a={menuFor} onClose={() => setMenuFor(null)} onEdit={() => { setEditing(menuFor); setMenuFor(null); }} onRemove={async () => { const id = menuFor.id; setMenuFor(null); await onRemove(id); }} />}
      {editing && <EditSheet a={editing} onClose={() => setEditing(null)} onSave={async (v) => { if (await onEdit(editing.id, v)) setEditing(null); else return "That did not save. Try again."; }} />}
    </>
  );
}

function MenuSheet({ a, onClose, onEdit, onRemove }: { a: SavedAddress; onClose: () => void; onEdit: () => void; onRemove: () => void }) {
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

function EditSheet({ a, onClose, onSave }: { a: SavedAddress; onClose: () => void; onSave: (v: { label: string; address: string; pin: string }) => Promise<string | void> }) {
  const fit = useSheetFit();
  const [v, setV] = useState({ label: a.label, address: a.address, pin: a.pin });
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (v.label.trim().length < 1 || v.label.trim().length > 30) return setError("Give it a name of 1 to 30 characters.");
    if (v.address.trim().length < 5) return setError("Type the address, at least 5 characters.");
    if (!isPin(v.pin)) return setError("The pin code is six digits.");
    setError((await onSave(v)) ?? null);
  };
  return (
    <div ref={fit} className="ui-sheet-back" onClick={onClose}>
      <section className="ui-sheet" role="dialog" aria-modal="true" aria-label={`Edit ${a.label}`} onClick={(e) => e.stopPropagation()}>
        <div className="ui-sheet-head"><h2>Edit {a.label}</h2></div>
        <div className="ui-field"><label htmlFor="sa-label">Label · Home, Office, Nani&apos;s house</label><input id="sa-label" type="text" maxLength={30} value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} /></div>
        <div className="ui-field"><label htmlFor="sa-addr">Address</label><textarea id="sa-addr" rows={2} maxLength={300} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        <div className="ui-field"><label htmlFor="sa-pin">Pin code</label><input id="sa-pin" className="mono-input" type="tel" inputMode="numeric" maxLength={6} placeholder="000000" value={v.pin} onChange={(e) => setV({ ...v, pin: e.target.value.trim() })} /></div>
        {error && <p role="alert" className="ui-field-error">{error}</p>}
        <button type="button" className="ui-btn big" onClick={() => void save()}>Save</button>
        <button type="button" className="ui-btn ghost big" onClick={onClose}>Cancel</button>
      </section>
    </div>
  );
}
