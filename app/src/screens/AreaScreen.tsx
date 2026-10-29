// The first question of the customer app (story B2, rebuilt in story #668, boards A1 to A3): where does the food go? The customer's own address, never the kitchen's.
// Ask (use my location, or type it) -> found (check it) or by hand. The kitchen is matched behind the scenes from the pin code and, when allowed, the place.
import { useState } from "react";
import { isPin } from "../lib/area";
import type { Area } from "../lib/area";
import { currentPlace, reverseAddress, type Place } from "../lib/locate";

type Props = { pin: string | null; address: string; area: Area | null; busy: boolean; error: string | null; onPlace: (p: { pin: string; address: string; from?: Place }) => void };
type Mode = "ask" | "found" | "hand";

export function AreaScreen({ pin, address: start, area, busy, error, onPlace }: Props) {
  const [mode, setMode] = useState<Mode>(pin ? "hand" : "ask");   // a pin that was already given (not served, or being looked up) goes straight to the form
  const [address, setAddress] = useState(start);
  const [text, setText] = useState(pin ?? "");
  const [place, setPlace] = useState<Place | undefined>(undefined);
  const [finding, setFinding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const none = area?.kind === "none";
  const ready = address.trim().length > 0 && isPin(text);

  async function useLocation() {
    setFinding(true);
    setNote(null);
    try {
      const here = await currentPlace();
      const found = await reverseAddress(here.lat, here.lng);
      if (!found) throw new Error("not_found");
      setPlace(here);
      setAddress(found.address);
      setText(found.pin);
      setMode("found");
    } catch {
      setNote("We could not get your location. Type it by hand.");
      setMode("hand");
    } finally {
      setFinding(false);
    }
  }

  const form = (
    <>
      <div className="ui-field">
        <label htmlFor="address">Address · food gets delivered here</label>
        <textarea id="address" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="ui-field">
        <label htmlFor="pin">Pin code</label>
        <input id="pin" className="ui-pin-input" type="tel" inputMode="numeric" maxLength={6} placeholder="110024" value={text}
          aria-invalid={!!(error || none) || undefined} aria-describedby={error || none ? "pin-help" : undefined}
          onChange={(e) => setText(e.target.value.trim())} />
        {error && <p id="pin-help" role="alert" className="ui-field-error">{error}</p>}
        {!error && none && <p id="pin-help" role="status" className="ui-field-error">Not here yet. We do not deliver to {pin} yet.</p>}
      </div>
      {none && <p className="ui-note">A pin code next to yours may work.</p>}
      {busy && <p role="status" className="ui-note">Finding your kitchen…</p>}
      <button type="button" className="ui-btn big" disabled={busy || !ready} onClick={() => onPlace({ pin: text, address: address.trim(), from: place })}>See the menu</button>
    </>
  );

  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Hot meals from our kitchen · cash at the door</p>
      </header>
      <div className="ui-slip" role="group" aria-label="Your address">
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>Your address</span><span>{mode === "ask" ? "Step 2 of 3" : "Step 3 of 3"}</span></div>
          {mode === "ask" && (
            <>
              <h2 className="ui-slip-title">Where does the food go?</h2>
              <p className="ui-meta">Allow location and we fill in your address. You can fix it before the menu opens.</p>
              <button type="button" className="ui-btn big" disabled={finding} onClick={useLocation}>{finding ? "Finding you…" : "Use my location"}</button>
              <button type="button" className="ui-btn ghost big" onClick={() => setMode("hand")}>Type it by hand</button>
            </>
          )}
          {mode === "found" && (
            <>
              <h2 className="ui-slip-title">Is this right?</h2>
              <p className="ui-meta">We found this from your location. Fix anything, then go on.</p>
              {form}
            </>
          )}
          {mode === "hand" && (
            <>
              <h2 className="ui-slip-title">Where does the food go?</h2>
              <p className="ui-meta">Type your address and pin code. The rider reads this.</p>
              {note && <p role="status" className="ui-note">{note}</p>}
              {form}
            </>
          )}
        </div>
      </div>
      <div className="ui-landing-foot">
        <p className="ui-kicker">No app to install · no card needed</p>
      </div>
    </section>
  );
}
