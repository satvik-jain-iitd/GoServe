// Story #1052 (boards A11 the Location row, A12 the kitchen pin): where a kitchen stands. A row in the form shows the set place or "Set the location"; a tap opens the one shared
// pin map screen (kitchen mode, Save location). No map inside the form (it replaces the inline map of story #905). Leaflet loads in PinMapScreen only.
import { useEffect, useState } from "react";
import { findAddress, type Place } from "../lib/locate";
import type { Loc } from "../lib/admin";
import { PinMapScreen } from "./PinMapScreen";

const DELHI: Place = { lat: 28.6139, lng: 77.209 };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
export const locationLine = (l: Loc): string => [`${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`, l.at ? `set ${day(l.at)}` : ""].filter(Boolean).join(" · ");
const PIN = <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.6" fill="#ffffff" /></svg>;
const GO = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>;

type Props = { loc: Loc | null; name: string; pins: string[]; onChange: (l: Loc) => void | Promise<void> };

export function KitchenLocation({ loc, name, pins, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<{ key: string; words: string } | null>(null);   // the words of the pin: from the save just made, else one lookup
  const key = loc ? `${loc.lat},${loc.lng}` : "";
  useEffect(() => {
    if (!loc || said?.key === key) return;
    let gone = false;
    void findAddress(loc.lat, loc.lng).then((w) => { if (!gone && w) setSaid({ key, words: w.address }); }).catch(() => undefined);
    return () => { gone = true; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  const title = !loc ? "Set the location" : said?.key === key ? said.words.split(",").slice(0, 2).join(",").trim() : "Pinned on the map";
  return (
    <div className="ui-field">
      <span className="ui-locrow-label">Location</span>
      <button type="button" className="ui-locrow" aria-label={`Location, ${title}`} onClick={() => setOpen(true)}>
        <span className="ui-locrow-icon">{PIN}</span>
        <span className="ui-locrow-words"><span className="ui-locrow-title">{title}</span><span className="ui-locrow-sub mono" data-testid="location-line">{loc ? locationLine(loc) : "No location yet. Nearest rider cannot be picked."}</span></span>
        <span className="ui-locrow-go">{GO}</span>
      </button>
      {open && <PinMapScreen center={loc ?? DELHI} zoom={loc ? 17 : 12} kicker={`Location of ${name.trim() || "the kitchen"}`} confirmLabel="Save location" kitchen={{ pins }}
        onBack={() => setOpen(false)} onSearch={() => undefined} onSave={() => undefined}
        onPoint={({ at, words }) => { setOpen(false); if (words) setSaid({ key: `${at.lat},${at.lng}`, words: words.address }); void onChange({ lat: at.lat, lng: at.lng, accuracy: null, at: new Date().toISOString() }); }} />}
    </div>
  );
}
