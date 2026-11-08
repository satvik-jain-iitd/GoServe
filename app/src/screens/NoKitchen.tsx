// Story #1049 part 3 (board NK-A, replaces the old pin-code screen S-NoKitchen): no kitchen serves this pin. The place in the customer's own words, Change location (back to the map),
// and Tell me when you come here (one stored ask per person and pin).
import { cardWords } from "../lib/pinMap";

type Props = { address: string; ask: "idle" | "busy" | "done"; error: string | null; onChange: () => void; onTell: () => void };

export function NoKitchen({ address, ask, error, onChange, onTell }: Props) {
  const place = cardWords(address.trim() || null);
  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Hot meals from our kitchen for you in 20 mins</p>
      </header>
      <div className="ui-slip" role="group" aria-label="No kitchen here">
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>Your address</span><span>Step 4 of 4</span></div>
          <h2 className="ui-slip-title">We don't reach here yet</h2>
          <div className="ui-nkplace">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <span><b>{place.name}</b>{place.rest && <span>{place.rest}</span>}</span>
          </div>
          <button type="button" className="ui-btn big" onClick={onChange}>Change location</button>
          {ask === "done"
            ? <p role="status" className="ui-note">We will tell you when we come here.</p>
            : <button type="button" className="ui-btn ghost big" disabled={ask === "busy"} onClick={onTell}>Tell me when you come here</button>}
          {error && <p role="alert" className="ui-field-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
