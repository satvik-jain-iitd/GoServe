// Story #1049 part 3 (board NK-A, replaces the old pin-code screen S-NoKitchen): no kitchen serves this pin. The place in the customer's own words, Change location (back to the map),
// and Tell me when you come here (one stored ask per person and pin).
import { useEffect, useRef, useState } from "react";
import { cardWords } from "../lib/pinMap";
import { KICKER, MOTTO, RULE, SIGN, SITE, TITLE, letterParas, letterText } from "../lib/founderLetter";

const LINKEDIN = "https://www.linkedin.com/in/satvik-jain-iitd/";

type Props = { address: string; ask: "idle" | "busy" | "done"; error: string | null; offerPaise: number | null; onChange: () => void; onTell: () => void;
  onSaved?: () => void };   // story 1529 (board LF-NOKITCHEN-Away): a customer with saved addresses can go to one from here

// Story 1129 (board NK-L2): the co-founder's letter. Its words live in lib/founderLetter.ts, one list for the screen and for the shared text.
// Story 1563: the letter goes as a picture. Can this phone share a picture file at all? Asked with an empty file, before the drawing code is fetched.
function canShareFile() {
  try { return typeof navigator.share === "function" && !!navigator.canShare?.({ files: [new File([], "goserve-note.png", { type: "image/png" })] }); } catch { return false; }
}
/** The whole letter as one PNG at 2x, in the letter's own width. In the picture only: no buttons and no links line (a picture cannot be tapped),
 *  the site's address printed 24 px under the signature, and the picture ends 24 px under that line. The drawing code is fetched only here. */
async function letterPicture(node: HTMLElement) {
  const { domToBlob } = await import("modern-screenshot");
  await document.fonts.ready;
  const sign = node.querySelector(".ui-founder-sign"), foot = node.querySelector(".ui-founder-foot");
  if (!sign || !foot) throw new Error("the letter is not on the screen");
  const png = await domToBlob(node, {
    scale: 2,
    height: Math.ceil(sign.getBoundingClientRect().bottom - node.getBoundingClientRect().top + 24 + parseFloat(getComputedStyle(foot).lineHeight) + 24),   // measured, not the slip's height on the screen
    filter: (n) => !(n instanceof HTMLButtonElement || (n instanceof HTMLElement && n.classList.contains("ui-founder-links"))),
    onCloneEachNode: (n) => {   // the copy carries each part's size on the screen: the address line is shown, and the two boxes that lost a child fit their content again
      if (!(n instanceof HTMLElement)) return;
      if (n.classList.contains("ui-founder-foot")) n.style.display = "block";
      if (n.classList.contains("ui-slip-body") || n.classList.contains("ui-founder-by")) n.style.height = "auto";
    },
  });
  return new File([png], "goserve-note.png", { type: "image/png" });
}

function FounderNote({ place, offerPaise, onChange }: { place: string; offerPaise: number | null; onChange: () => void }) {
  const [copied, setCopied] = useState(false);
  const [again, setAgain] = useState(false);   // the phone refused the file and the text: say so, the next tap tries again
  const [busy, setBusy] = useState(false);
  const letter = useRef<HTMLDivElement>(null);
  const making = useRef<Promise<File | null> | null>(null);   // the picture while it is made
  const picture = useRef<File | null>(null);                  // the picture once it is ready
  // The picture is made when the letter shows, not at the tap: an iPhone opens the share sheet only inside the tap itself, and a wait would lose it.
  useEffect(() => {
    let live = true;
    picture.current = null;
    making.current = letter.current && canShareFile()
      ? letterPicture(letter.current).then((file) => { if (live) picture.current = file; return live ? file : null; }, () => { if (live) making.current = null; return null; })
      : null;
    return () => { live = false; };
  }, [place, offerPaise]);

  const { off, paras } = letterParas(place, offerPaise);
  async function share() {
    setAgain(false);
    const text = letterText(place, offerPaise);
    try {
      if (typeof navigator.share !== "function") { await navigator.clipboard.writeText(text); setCopied(true); return; }
      let file = picture.current;
      if (!file && making.current) {   // tapped before the picture is ready: wait for it, 5 seconds at most
        setBusy(true);
        file = await Promise.race([making.current, new Promise<null>((done) => setTimeout(done, 5000, null))]);
      }
      if (file) {
        try { await navigator.share({ files: [file] }); return; }
        catch (e) { if (e instanceof Error && e.name === "AbortError") return; }   // any other refusal of the file: the text goes
      }
      await navigator.share({ title: "A note from GoServe", text });   // the site's address is the text's last line
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setAgain(true); }   // a closed share sheet is not an error
    finally { setBusy(false); }
  }
  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
      </header>
      <div ref={letter} className="ui-slip ui-founder" role="group" aria-label={KICKER}>
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>{KICKER}</span></div>
          <div className="ui-founder-top">
            <svg role="img" aria-label="Photo of Satvik (placeholder)" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="26" fill="var(--md-surface-variant)" /><circle cx="26" cy="21" r="9" fill="var(--gs-text-muted)" /><path d="M9 45c3-9 10-13 17-13s14 4 17 13" fill="var(--gs-text-muted)" /></svg>
            <h2><span>{TITLE[0]}</span> <span>{TITLE[1]}</span></h2>
          </div>
          <div className="ui-founder-text">
            {paras.map((p) => off && p.includes(off) ? <p key={p}>{p.split(off)[0]}<b>{off}</b>{p.split(off)[1]}</p> : <p key={p}>{p}</p>)}
            <div className="ui-founder-pause" aria-hidden="true" />
            <p>{RULE}</p>
            <p className="ui-founder-motto"><b>{MOTTO[0]}</b><br />{MOTTO[1]}</p>
          </div>
          <div className="ui-founder-by">
            <p className="ui-founder-sign">{SIGN}</p>
            <p className="ui-founder-links"><a href={LINKEDIN} target="_blank" rel="noreferrer">LinkedIn</a> · <a href={SITE} target="_blank" rel="noreferrer">letsdwelo.in</a></p>
          </div>
          <p className="ui-founder-foot" hidden>letsdwelo.in</p>   {/* story 1563: printed on the shared picture only */}
          <button type="button" className="ui-btn big ui-founder-share" disabled={busy} aria-live="polite" onClick={() => void share()}>{busy ? "Preparing…" : again ? "Tap again to share" : "Share this note"}</button>
          {copied && <p role="status" className="ui-note">Copied. Paste it anywhere.</p>}
          <button type="button" className="ui-btn ghost big" onClick={onChange}>Change location</button>
        </div>
      </div>
    </section>
  );
}

export function NoKitchen({ address, ask, error, offerPaise, onChange, onTell, onSaved }: Props) {
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
          <h2 className="ui-slip-title">We don't reach here yet</h2>
          <div className="ui-nkplace">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <span><b>{place.name}</b>{place.rest && <span>{place.rest}</span>}</span>
          </div>
          <button type="button" className="ui-btn ghost big" disabled={ask === "busy"} onClick={onTell}>Tell me when you come here</button>
          {onSaved && <button type="button" className="ui-btn ghost big" onClick={onSaved}>Deliver to a saved address</button>}
          <button type="button" className="ui-btn big" onClick={onChange}>Change location</button>   {/* board LF12: the filled button is last */}
          {error && <p role="alert" className="ui-field-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
