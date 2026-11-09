// Story #1049 part 3 (board NK-A, replaces the old pin-code screen S-NoKitchen): no kitchen serves this pin. The place in the customer's own words, Change location (back to the map),
// and Tell me when you come here (one stored ask per person and pin).
import { useState } from "react";
import { cardWords } from "../lib/pinMap";

const SITE = "https://letsdwelo.in/";
const LINKEDIN = "https://www.linkedin.com/in/satvik-jain-iitd/";

type Props = { address: string; ask: "idle" | "busy" | "done"; error: string | null; offerPaise: number | null; onChange: () => void; onTell: () => void };

/** Story #1129 (board NK-L2): the co-founder's letter. The promise is written only when the stored row holds it (offerPaise), so the words are always true. */
function letterText(place: string, offerPaise: number | null) {
  const promise = offerPaise ? ` So here is my promise: the day we open in ${place}, your first order is ₹${Math.round(offerPaise / 100)} off. We will message you.` : "";
  return `We don't reach ${place} yet. I am sorry you came all this way for nothing today. We are a small, new kitchen, and we are growing fast. You trusted us first. That means a lot to me.${promise} At GoServe we have one rule: Pahle banda, phir dhanda. People first, business after. - Satvik, co-founder, GoServe`;
}

function FounderNote({ place, offerPaise, onChange }: { place: string; offerPaise: number | null; onChange: () => void }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const text = letterText(place, offerPaise);
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: "A note from GoServe", text, url: SITE });
      else { await navigator.clipboard.writeText(`${text} ${SITE}`); setCopied(true); }
    } catch { /* a closed share sheet is not an error */ }
  }
  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
      </header>
      <div className="ui-slip ui-founder" role="group" aria-label="A letter from co-founder Satvik Jain">
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>A letter from co-founder Satvik Jain</span></div>
          <div className="ui-founder-top">
            <svg role="img" aria-label="Photo of Satvik (placeholder)" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="26" fill="var(--md-surface-variant)" /><circle cx="26" cy="21" r="9" fill="var(--gs-text-muted)" /><path d="M9 45c3-9 10-13 17-13s14 4 17 13" fill="var(--gs-text-muted)" /></svg>
            <h2><span>You found us early.</span> <span>Thank you.</span></h2>
          </div>
          <div className="ui-founder-text">
            <p>We don't reach {place} yet. I am sorry you came all this way for nothing today.</p>
            <p>We are a small, new kitchen, and we are growing fast. You trusted us first. That means a lot to me.</p>
            {offerPaise ? <p>So here is my promise: the day we open in {place}, your first order is <b>₹{Math.round(offerPaise / 100)} off</b>. We will message you.</p> : null}
            <div className="ui-founder-pause" aria-hidden="true" />
            <p>At GoServe we have one rule.</p>
            <p className="ui-founder-motto"><b>Pahle banda, phir dhanda.</b><br />People first, business after.</p>
          </div>
          <div>
            <p className="ui-founder-sign">Satvik</p>
            <p className="ui-founder-links"><a href={LINKEDIN} target="_blank" rel="noreferrer">LinkedIn</a> · <a href={SITE} target="_blank" rel="noreferrer">letsdwelo.in</a></p>
          </div>
          <button type="button" className="ui-btn big ui-founder-share" onClick={() => void share()}>Share this note</button>
          {copied && <p role="status" className="ui-note">Copied. Paste it anywhere.</p>}
          <button type="button" className="ui-btn ghost big" onClick={onChange}>Change location</button>
        </div>
      </div>
    </section>
  );
}

export function NoKitchen({ address, ask, error, offerPaise, onChange, onTell }: Props) {
  const place = cardWords(address.trim() || null);
  if (ask === "done") return <FounderNote place={place.name} offerPaise={offerPaise} onChange={onChange} />;
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
          <button type="button" className="ui-btn ghost big" disabled={ask === "busy"} onClick={onTell}>Tell me when you come here</button>
          {error && <p role="alert" className="ui-field-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
