// Story #1037 (boards C6-PinMap, C9-EditOnMap later): the one full-screen map for every location pick. A plain DOM pin sits at the centre of the map box and the map moves under it
// (never a Leaflet marker). 400 ms after it stops the words (Ola through lib/locate, OpenStreetMap as the fallback) and the served strip follow the centre. No zoom control (pinch and double tap
// only), no inline map anywhere. The phone's place is a brown dot only when location is already allowed; this screen never asks for it by itself.
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker } from "leaflet";
import { currentPlace, findAddress, type Looked, type Place } from "../lib/locate";
import { isPin } from "../lib/area";
import { addressText, cardWords, serveAt, stripsFor, type Serve } from "../lib/pinMap";
import { tileUrl } from "../lib/riderMap";

const TILES = tileUrl(import.meta.env.VITE_MAP_TILES);
const SETTLE_MS = 400;
const OSM = "https://www.openstreetmap.org/copyright";
const I = (d: React.ReactNode, w = 22) => <svg aria-hidden="true" width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const PIN_PATH = <><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>;

export type PinPick = { at: Place; words: Looked | null; served: boolean | null };
export type Saved = { pin: string; address: string; label: string; from: Place };   // story #1038: what the details step hands to the save
type Props = {
  center: Place; zoom?: number; kicker?: string; confirmLabel: string;
  onBack: () => void; onSearch: () => void; onSave: (a: Saved) => void;
  lookup?: (p: Place) => Promise<Looked | null>; serve?: (p: Place) => Promise<Serve | null>;
};

export function PinMapScreen({ center, zoom = 17, kicker, confirmLabel, onBack, onSearch, onSave, lookup = (p) => findAddress(p.lat, p.lng), serve = (p) => serveAt(p) }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<{ map: LMap; L: typeof import("leaflet"); dot: Marker | null } | null>(null);
  const [point, setPoint] = useState<Place>(center);
  const [words, setWords] = useState<Looked | null>(null);
  const [failed, setFailed] = useState(false);
  const [served, setServed] = useState<Serve | null>(null);
  const [busy, setBusy] = useState(true);
  const [here, setHere] = useState<Place | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const [pick, setPick] = useState<PinPick | null>(null);   // story #1038: set when Confirm is tapped; the details sheet shows over the same map
  const ask = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fns = useRef({ lookup, serve });
  fns.current = { lookup, serve };

  const settle = (p: Place) => {   // the pin rests: one lookup and one serviceability answer for the last place only
    setPoint(p);
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const mine = ++ask.current;
      const [w, s] = await Promise.all([fns.current.lookup(p).catch(() => null), fns.current.serve(p).catch(() => null)]);
      if (mine !== ask.current) return;   // a newer rest has taken over
      if (w) { setWords(w); setFailed(false); } else setFailed(true);   // the last words stay when this one fails; the point still counts
      if (s) setServed(s);
      setBusy(false);
    }, SETTLE_MS);
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

  useEffect(() => {
    let gone = false;
    let watch: number | null = null;
    void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      if (gone || !box.current) return;
      const map = L.map(box.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, boxZoom: false, keyboard: false }).setView([center.lat, center.lng], zoom, { animate: false });
      if (TILES) L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
      map.on("moveend", () => { const c = map.getCenter(); settleRef.current({ lat: c.lat, lng: c.lng }); });
      live.current = { map, L, dot: null };
      settleRef.current(center);
      void navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((perm) => {   // only when already allowed: this screen never asks
        if (gone || perm.state !== "granted" || !("geolocation" in navigator)) return;
        watch = navigator.geolocation.watchPosition((p) => {
          const at = { lat: p.coords.latitude, lng: p.coords.longitude };
          setHere(at);
          const m = live.current;
          if (!m) return;
          if (!m.dot) m.dot = m.L.marker([at.lat, at.lng], { interactive: false, keyboard: false, icon: m.L.divIcon({ className: "gs-here-dot", iconSize: [26, 26], iconAnchor: [13, 13], html: "<i></i>" }) }).addTo(m.map);
          else m.dot.setLatLng([at.lat, at.lng]);
        }, () => undefined, { enableHighAccuracy: true });
      }).catch(() => undefined);
    });
    return () => {
      gone = true;
      if (timer.current) clearTimeout(timer.current);
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      live.current?.map.remove(); live.current = null;
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {   // the map stays behind the sheet, still, and shrinks to the part above it so the pin stays in view
    const m = live.current;
    if (!m) return;
    const h = m.map;
    for (const x of [h.dragging, h.touchZoom, h.doubleClickZoom]) (pick ? x.disable() : x.enable());
    const c = pick ? pick.at : null;
    h.invalidateSize({ pan: false });
    if (c) h.setView([c.lat, c.lng], h.getZoom(), { animate: false });
  }, [pick]);

  const toPhone = async () => {
    setNote(null);
    try {
      const p = await currentPlace();
      live.current?.map.setView([p.lat, p.lng], 17, { animate: false });
    } catch {
      setNote("Could not get your location. Allow location and try again.");
    }
  };

  const name = cardWords(words?.address ?? null);
  const strips = stripsFor({ serve: served, here, pin: point });
  return (
    <section ref={root} className="ui-pinmap" role="region" aria-label="Pin map" data-step={pick ? "details" : "pin"}>
      <div ref={box} className="ui-pinmap-map" role="application" aria-label="Map" />
      <span className="ui-pinmap-pin" data-testid="map-pin" aria-hidden="true">{I(PIN_PATH, 40)}</span>
      <div className="ui-pinmap-top">
        <button type="button" className="ui-pinmap-back" aria-label="Back" onClick={onBack}>{I(<path d="M15 5l-7 7 7 7" />)}</button>
        {!pick && <button type="button" className="ui-pinmap-search" aria-label="Search an area or address" onClick={onSearch}><span>Search an area or address</span>{I(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>, 20)}</button>}
      </div>
      {!pick && <div className="ui-pinmap-card">
        <button type="button" className="ui-pinmap-here" onClick={() => void toPhone()}>{I(<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>, 18)}<span>Current Location</span></button>
        {kicker && <span className="mono ui-pinmap-kicker">{kicker}</span>}
        <div className="ui-pinmap-place">{I(PIN_PATH, 24)}<span className="ui-pinmap-name">{name.name}</span></div>
        {name.rest && <span className="ui-pinmap-addr">{name.rest}</span>}
        {failed && <span className="ui-pinmap-addr ui-pinmap-quiet">Could not read the address, the pin still counts</span>}
        {note && <span role="alert" className="ui-pinmap-addr ui-pinmap-quiet">{note}</span>}
        {strips.map((s) => <span key={s.kind} role="status" className={`ui-pinmap-strip ${s.kind}`}>{s.text}</span>)}
        <button type="button" className="ui-btn big" disabled={busy} onClick={() => setPick({ at: point, words, served: served ? served.serviceable : null })}>{confirmLabel}</button>
        <span className="mono ui-pinmap-credit">{words?.from === "ola" && <><a href={OSM} target="_blank" rel="noopener noreferrer">Ola Maps</a> · </>}<a href={OSM} target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></span>
      </div>}
      {pick && <DetailsSheet pick={pick} onChange={() => setPick(null)} onSave={onSave} onHeight={(h) => { root.current?.style.setProperty("--sheet-h", `${h}px`); live.current?.map.invalidateSize({ pan: false }); const c = pick.at; live.current?.map.setView([c.lat, c.lng], live.current.map.getZoom(), { animate: false }); }} />}
    </section>
  );
}

const CHIPS = ["Home", "Office", "Other"] as const;
// Story #1038 (board C7-PinDetails): the words the rider needs, and the save. The pin's exact place is the one the map rested on.
function DetailsSheet({ pick, onChange, onSave, onHeight }: { pick: PinPick; onChange: () => void; onSave: (a: Saved) => void; onHeight: (h: number) => void }) {
  const el = useRef<HTMLElement>(null);
  const tell = useRef(onHeight);
  tell.current = onHeight;
  useEffect(() => {   // the map above keeps exactly the part the sheet leaves free
    const e = el.current;
    if (!e || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => tell.current(e.getBoundingClientRect().height));
    ro.observe(e);
    return () => ro.disconnect();
  }, []);
  const [house, setHouse] = useState("");
  const [landmark, setLandmark] = useState("");
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("Home");
  const [custom, setCustom] = useState("");
  const [area, setArea] = useState("");
  const [pinText, setPinText] = useState("");
  const found = (pick.words?.address ?? "").trim();
  const needArea = found === "";
  const needPin = !isPin(pick.words?.pin ?? "");
  const name = cardWords(found || null);
  const label = chip === "Other" ? custom.trim() : chip;
  const pin = needPin ? pinText.trim() : pick.words?.pin ?? "";
  const ready = house.trim().length >= 1 && label.length >= 1 && label.length <= 30 && (!needArea || area.trim().length >= 2) && isPin(pin);   // Save stays asleep until it can work
  const save = () => { if (ready) onSave({ pin, address: addressText(house, landmark, needArea ? area : found), label, from: pick.at }); };
  return (
    <section ref={el} className="ui-pinmap-details" role="dialog" aria-label="Address details">
      <div className="ui-sheet-head ui-pinmap-details-head"><h2>Address details</h2><span className="mono">Step 2 of 2</span></div>
      <div className="ui-pinmap-where">{I(PIN_PATH, 22)}<span className="ui-pinmap-where-words"><b>{name.name}</b>{name.rest && <span>{name.rest}</span>}</span><button type="button" className="ui-pinmap-change" onClick={onChange}>Change</button></div>
      {needArea && <div className="ui-field"><label htmlFor="pd-area">Area or street</label><input id="pd-area" type="text" maxLength={200} value={area} onChange={(e) => setArea(e.target.value)} /></div>}
      {needPin && <div className="ui-field"><label htmlFor="pd-pin">Pin code</label><input id="pd-pin" className="mono-input" type="tel" inputMode="numeric" maxLength={6} placeholder="123456" value={pinText} onChange={(e) => setPinText(e.target.value.trim())} /></div>}
      <div className="ui-field"><label htmlFor="pd-house">House, flat, floor</label><input id="pd-house" type="text" placeholder="C-128, second floor" maxLength={120} value={house} onChange={(e) => setHouse(e.target.value)} /></div>
      <div className="ui-field"><label htmlFor="pd-landmark">Landmark (optional)</label><input id="pd-landmark" type="text" placeholder="near the park gate" maxLength={120} value={landmark} onChange={(e) => setLandmark(e.target.value)} /></div>
      <div className="ui-pinmap-saveas"><span className="mono ui-pinmap-kicker">Save as</span>
        <div className="ui-chips">{CHIPS.map((c) => <button key={c} type="button" className={`ui-chip${chip === c ? " on" : ""}`} aria-pressed={chip === c} onClick={() => setChip(c)}>{c}</button>)}</div></div>
      {chip === "Other" && <div className="ui-field"><label htmlFor="pd-name">Name this place</label><input id="pd-name" type="text" maxLength={30} value={custom} onChange={(e) => setCustom(e.target.value)} /></div>}
      <button type="button" className="ui-btn big" disabled={!ready} onClick={save}>Save address</button>
    </section>
  );
}
