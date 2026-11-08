// The first question of the customer app (story B2, rebuilt in story #668, boards A1 to A3): where does the food go? The customer's own address, never the kitchen's.
// Ask (use my location, or type it by hand). Story #1049 (boards A1, A1p): Use my location opens the full-screen pin map at the phone (the same screen as C6); the phone not giving
// its place opens the search. The kitchen is matched behind the scenes from the pin code and, when allowed, the place.
import { useState } from "react";
import { isPin } from "../lib/area";
import type { Area } from "../lib/area";
import { currentPlace, type Place } from "../lib/locate";

type Props = { pin: string | null; address: string; area: Area | null; busy: boolean; error: string | null; onPlace: (p: { pin: string; address: string }) => void;
  onMap: (at: Place) => void; onSearch: () => void;   // story #1049: the pin map at the phone; the search when the phone does not give its place
};
type Mode = "ask" | "hand";

export function AreaScreen({ pin, address: start, area, busy, error, onPlace, onMap, onSearch }: Props) {
  const [mode, setMode] = useState<Mode>(pin ? "hand" : "ask");
  const [address, setAddress] = useState(start);
  const [text, setText] = useState(pin ?? "");
  const [finding, setFinding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const none = area?.kind === "none";
  const ready = address.trim().length > 0 && isPin(text);

  async function useLocation() {
    setFinding(true);
    setNote(null);
    try {
      onMap(await currentPlace());   // the map opens at the phone; the words come from the pin there
    } catch {
      onSearch();   // location not given: search, and a picked result lands on the same map
    } finally {
      setFinding(false);
    }
  }

  const form = (
    <>
      <div className="ui-field">
        <label htmlFor="address">Address</label>
        <textarea id="address" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="ui-field">
        <label htmlFor="pin">Pin code</label>
        <input id="pin" className="ui-pin-input" type="tel" inputMode="numeric" maxLength={6} placeholder="123456" value={text}
          aria-invalid={!!(error || none) || undefined} aria-describedby={error || none ? "pin-help" : undefined}
          onChange={(e) => setText(e.target.value.trim())} />
        {error && <p id="pin-help" role="alert" className="ui-field-error">{error}</p>}
        {!error && none && <p id="pin-help" role="status" className="ui-field-error">Not here yet. We do not deliver to {pin} yet.</p>}
      </div>
      {none && <p className="ui-note">A pin code next to yours may work.</p>}
      {busy && <p role="status" className="ui-note">Finding your kitchen…</p>}
      <button type="button" className="ui-btn big" disabled={busy || !ready} onClick={() => onPlace({ pin: text, address: address.trim() })}>See the menu</button>
    </>
  );

  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Hot meals from our kitchen for you in 20 mins</p>
      </header>
      <div className="ui-slip" role="group" aria-label="Your address">
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>Your address</span><span>{mode === "ask" ? "Step 2 of 3" : "Step 3 of 3"}</span></div>
          {mode === "ask" && (
            <>
              <h2 className="ui-slip-title">Where does the food go?</h2>
              <p className="ui-meta ui-slip-line">We have multiple kitchens with hygienic homely food</p>
              <button type="button" className="ui-btn big" disabled={finding} onClick={useLocation}>{finding ? "Finding you…" : "Use my location"}</button>
              <button type="button" className="ui-btn ghost big" onClick={() => setMode("hand")}>Type it by hand</button>
            </>
          )}
          {mode === "hand" && (
            <>
              <h2 className="ui-slip-title">Where does the food go?</h2>
              {note && <p role="status" className="ui-note">{note}</p>}
              {form}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
