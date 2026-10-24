// The first question of the customer app (story B2): where to deliver. Answered once; "Change area" asks again.
// Built to the Ink v3 boards 01 and 01e (story H10b, #193).
import { useState } from "react";
import { isPin, openingText } from "../lib/area";
import type { Area } from "../lib/area";

type Props = { pin: string | null; area: Area | null; busy: boolean; error: string | null; onPin: (pin: string) => void };

export function AreaScreen({ pin, area, busy, error, onPin }: Props) {
  const [text, setText] = useState(pin ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const none = area?.kind === "none";
  const shown = problem ?? error;
  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Hot meals from our kitchen · cash at the door</p>
      </header>
      <div className="ui-slip" role="group" aria-label="Delivery place">
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>Pin code</span><span>Cash only</span></div>
          <h2 className="ui-slip-title">Where should we deliver?</h2>
          <div className="ui-field">
            <label htmlFor="pin">Pin code</label>
            <input id="pin" className="ui-pin-input" type="tel" inputMode="numeric" maxLength={6} placeholder="110024" value={text}
              aria-invalid={!!(shown || none) || undefined} aria-describedby={shown || none ? "pin-help" : undefined}
              onChange={(e) => setText(e.target.value.trim())} />
            {shown && <p id="pin-help" role="alert" className="ui-field-error">{shown}</p>}
            {!shown && none && <p id="pin-help" role="status" className="ui-field-error">We are not in {pin} yet. We saved your pin code and will tell you when we arrive.</p>}
          </div>
          <p className="ui-note">{none ? "We add pin codes every week. A pin next to yours may work." : "We serve a few pin codes for now."}</p>
          {busy && <p role="status" className="ui-note">Finding your kitchen…</p>}
          {area?.kind === "closed" && <p role="status" className="ui-note">{openingText(area.name, area.opens_at)}</p>}
          <button type="button" className="ui-btn big" disabled={busy} onClick={() => (isPin(text) ? (setProblem(null), onPin(text)) : setProblem("A pin code is six digits."))}>Show kitchen</button>
        </div>
      </div>
      <p className="ui-kicker ui-landing-foot">No app to install · no card needed</p>
    </section>
  );
}
