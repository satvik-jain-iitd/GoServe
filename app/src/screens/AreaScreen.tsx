// The first question of the customer app (story B2, rebuilt in story #668, boards A1 to A3): where does the food go? The customer's own address, never the kitchen's.
// Ask (use my location, or type it) -> found (check it) or by hand. The kitchen is matched behind the scenes from the pin code and, when allowed, the place.
import { useState } from "react";
import { isPin } from "../lib/area";
import type { Area } from "../lib/area";
import { currentPlace, findAddress, type Place } from "../lib/locate";

type Props = { pin: string | null; address: string; area: Area | null; busy: boolean; error: string | null; onPlace: (p: { pin: string; address: string; label?: string; from?: Place; located?: string }) => void;
  adding?: { mode: "ask" | "hand"; words?: string; onBack: () => void };   // story #976: opened from the Deliver to page to add one more address; it asks for a label too
};
type Mode = "ask" | "found" | "hand";

export function AreaScreen({ pin, address: start, area, busy, error, onPlace, adding }: Props) {
  const [mode, setMode] = useState<Mode>(adding ? adding.mode : pin ? "hand" : "ask");
  const [label, setLabel] = useState("");   // a pin that was already given (not served, or being looked up) goes straight to the form
  const [address, setAddress] = useState(adding ? adding.words ?? "" : start);
  const [text, setText] = useState(adding ? "" : pin ?? "");
  const [place, setPlace] = useState<Place | undefined>(undefined);
  const [pinMissing, setPinMissing] = useState(false);   // story #969: the location found an address but no pin, even from the nearest tagged object
  const [from, setFrom] = useState<"ola" | "osm" | null>(null);   // story #998: who named the words; the Ola credit shows only for Ola's
  const [located, setLocated] = useState<string | undefined>(undefined);   // story #910: the address the location found, to tell a hand edit from it
  const [finding, setFinding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const none = area?.kind === "none";
  const ready = address.trim().length > 0 && isPin(text) && (!adding || label.trim().length > 0);

  async function useLocation() {
    setFinding(true);
    setNote(null);
    try {
      const here = await currentPlace();
      const found = await findAddress(here.lat, here.lng);
      if (!found) throw new Error("not_found");
      setPlace(here);
      setFrom(found.from);
      setLocated(found.address);
      setAddress(found.address);
      setText(found.pin);
      setPinMissing(found.pin === "");
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
      {adding && <div className="ui-field"><label htmlFor="label">Label · Home, Office, Nani&apos;s house</label><input id="label" type="text" maxLength={30} value={label} onChange={(e) => setLabel(e.target.value)} /></div>}
      <div className="ui-field">
        <label htmlFor="address">Address · food gets delivered here</label>
        <textarea id="address" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="ui-field">
        <label htmlFor="pin">Pin code</label>
        <input id="pin" className="ui-pin-input" type="tel" inputMode="numeric" maxLength={6} placeholder="000000" value={text}
          aria-invalid={!!(error || none) || undefined} aria-describedby={error || none || (pinMissing && text === "") ? "pin-help" : undefined}
          onChange={(e) => setText(e.target.value.trim())} />
        {error && <p id="pin-help" role="alert" className="ui-field-error">{error}</p>}
        {!error && !none && pinMissing && text === "" && <p id="pin-help" role="status" className="ui-field-error">We could not find your pin code. Type it.</p>}
        {!error && none && <p id="pin-help" role="status" className="ui-field-error">Not here yet. We do not deliver to {pin} yet.</p>}
      </div>
      {none && <p className="ui-note">A pin code next to yours may work.</p>}
      {busy && <p role="status" className="ui-note">Finding your kitchen…</p>}
      <button type="button" className="ui-btn big" disabled={busy || !ready} onClick={() => onPlace({ pin: text, address: address.trim(), label: label.trim() || undefined, from: place, located })}>{adding ? "Save address" : "See the menu"}</button>
    </>
  );

  return (
    <section className="ui-landing">
      {adding && <button type="button" className="ui-back" aria-label="Back" onClick={adding.onBack}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>}
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
              {from === "ola" && <p className="ui-credit mono">Address words: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Ola Maps</a> · Map: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></p>}
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
