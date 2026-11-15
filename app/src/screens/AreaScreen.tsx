// The first question of the customer app (story B2, rebuilt in story #668, boards A1 to A3): where does the food go? The customer's own address, never the kitchen's.
// Ask (use my location, or search). Story 1049 (boards A1, A1p): Use my location opens the full-screen pin map at the phone (the same screen as C6); the phone not giving
// its place says why in a true line (bug 1526, board LF-ASK-B): then asking again is the outline button and search is the filled one. The kitchen is matched behind the scenes
// from the pin code and, when allowed, the place.
// Story 1528: no box to type an address and a postal code here; a place always comes with a point from the map. When the kitchen of a place could not be read (no internet),
// the same box says so and the filled button is "Try again".
import { useEffect, useRef, useState, type Ref } from "react";
import type { Area } from "../lib/area";
import { currentPlace, locLine, locWhy, type LocWhy, type Place } from "../lib/locate";
import { useAfterMotion } from "../lib/afterMotion";

type Props = { area: Area | null; busy: boolean; error: string | null; onRetry: () => void;   // error: the kitchen of the place could not be read; onRetry reads it again
  onMap: (at: Place) => void; onSearch: () => void;   // story #1049: the pin map at the phone; the search
  finding?: { leaving: boolean; onLeft: () => void };   // story 1384 (board A1e): the first Save address; the kitchen is being found. leaving: it was found, the rider rides out, then onLeft
};
const OFF = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /><path d="M3 3l18 18" /></svg>;
const WARN = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>;

export function AreaScreen({ busy, error, onRetry, onMap, onSearch, finding }: Props) {
  const [locating, setLocating] = useState(false);
  const [why, setWhy] = useState<LocWhy | null>(null);   // bug 1526: why the phone did not give its place
  const line = error ?? (why && locLine(why, "search for your address"));
  const leaving = !!finding?.leaving;
  const riding = useRef<HTMLSpanElement>(null);
  const ask = useAfterMotion(riding) ? "ui-arrive" : "ui-await";   // story 1524: the two buttons show when the rider has stopped; their space is kept
  const onLeft = useRef(finding?.onLeft);
  onLeft.current = finding?.onLeft;   // the latest callback, so the timer starts once per ride out
  useEffect(() => {   // story 1384: the menu shows when the 0.8 s ride out ends; with reduce motion at once
    if (!leaving) return;
    const t = setTimeout(() => onLeft.current?.(), window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 800);
    return () => clearTimeout(t);
  }, [leaving]);

  async function useLocation() {
    setLocating(true);
    try {
      onMap(await currentPlace());   // the map opens at the phone; the words come from the pin there
    } catch (e) {
      setWhy(locWhy(e, why));   // the true line; search is then the filled button, and a picked result lands on the same map
    } finally {
      setLocating(false);
    }
  }

  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Hot meals from our kitchen for you in 20 mins</p>
      </header>
      <div className="ui-slip" role="group" aria-label="Your address">
        <div className="ui-slip-body">
          {finding ? (
            <>
              <h2 className="ui-slip-title">Finding your kitchen</h2>
              <p className="ui-slip-why">Your address is saved. <br />The menu opens in a moment.</p>
              <span aria-hidden="true" className="ui-pinbadge ui-hero-abs"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg></span>
              {lane(leaving ? "out" : "wait")}
            </>
          ) : (
            <>
              <h2 className="ui-slip-title">Where does the food go?</h2>
              <p className="ui-slip-why">We use it only to find your address <br />and the kitchen near you.</p>
              <span aria-hidden="true" className="ui-pinbadge ui-hero-abs"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg></span>
              {!line && lane("in", riding)}
              {line && <p role={error ? "alert" : "status"} className="ui-loc-note">{error ? WARN : OFF}<span>{line}</span></p>}   {/* board LF-ASK-B: the rider is left out, so no two boxes meet */}
              {error ? <button type="button" className="ui-btn ghost big" onClick={onSearch}>Search for my address</button>
                : why ? <button type="button" className="ui-btn ghost big" disabled={locating} onClick={useLocation}>{locating ? "Finding you…" : "Try location again"}</button>
                : <button type="button" className={`ui-btn ghost big ui-push ${ask}`} onClick={onSearch}>Search for my address</button>}
              {error ? <button type="button" className="ui-btn big" disabled={busy} onClick={onRetry}>Try again</button>
                : why ? <button type="button" className="ui-btn big" onClick={onSearch}>Search for my address</button>
                : <button type="button" className={`ui-btn big ${ask}`} disabled={locating} onClick={useLocation}>{locating ? "Finding you…" : "Use my current location"}</button>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// Stories 1381 and 1384 (boards A1d, A1e): a rider in a lane under the pin. "in" rides in once and waits, "wait" waits, "out" rides out to the right.
// The wheels, the road and the wind move while he is on screen; with reduce motion nothing moves and he stands in the centre.
function lane(how: "in" | "wait" | "out", ride?: Ref<HTMLSpanElement>) {
  const wheel = (cx: number) => <g className="ui-wheel"><circle cx={cx} cy="32" r="5" fill="var(--md-surface)" /><path d={`M${cx - 3.2} 32h6.4M${cx} 28.8v6.4`} strokeWidth="1.2" /></g>;
  return (
    <div className="ui-lane" aria-hidden="true">
      <span className="ui-lane-road" />
      <span ref={ride} className={`ui-ride ${how}`}>
        <svg className="ui-ride-wind" width="26" height="44" viewBox="0 0 26 44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 9h10" /><path d="M6 21h14" /><path d="M13 31h8" /></svg>
        <svg width="53" height="44" viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="11" height="11" rx="1.5" fill="var(--gs-lime-soft)" /><circle cx="22" cy="6.5" r="3.5" /><path d="M21 11l-2 12" /><path d="M21 13.5l10 4.5" /><path d="M19 23l7 1 1 7" /><path d="M8 24h13" /><path d="M10 32l3-8" /><path d="M15 32h12l5-14" /><path d="M29.5 18h5.5" /><path d="M33 18l5 14" />{wheel(10)}{wheel(38)}</svg>
      </span>
    </div>
  );
}
