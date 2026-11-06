// Story #905, board A-AddKitchen-Pin (A10): where a kitchen stands. A small map with a draggable pin, one ghost button for the phone's place, one mono line.
// Leaflet is loaded here (like the rider map, #691) and nowhere else. No search box and no geocoding: the admin stands at the kitchen, or moves the pin by hand.
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker } from "leaflet";
import { currentFix } from "../lib/locate";
import { tileUrl } from "../lib/riderMap";
import type { Loc } from "../lib/admin";

const TILES = tileUrl(import.meta.env.VITE_MAP_TILES);
const DELHI: [number, number] = [28.6139, 77.209];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
export const locationLine = (l: Loc): string =>
  [`${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}`, l.accuracy === null ? "moved by hand" : `±${Math.round(l.accuracy)} m`, l.at ? day(l.at) : ""].filter(Boolean).join(" · ");

type Props = { loc: Loc | null; onChange: (l: Loc) => void | Promise<void> };

export function KitchenLocation({ loc, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<{ map: LMap; pin: Marker | null; L: typeof import("leaflet") } | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const [error, setError] = useState<string | null>(null);
  const byHand = (lat: number, lng: number) => change.current({ lat, lng, accuracy: null, at: new Date().toISOString() });

  useEffect(() => {
    let gone = false;
    void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      if (gone || !box.current) return;
      const map = L.map(box.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: false }).setView(DELHI, 11);
      if (TILES) L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
      map.on("click", (e) => void byHand(e.latlng.lat, e.latlng.lng));   // a tap on the map moves the pin there
      live.current = { map, pin: null, L };
      show(L, map);
    });
    return () => { gone = true; live.current?.map.remove(); live.current = null; };
  }, []);

  const now = useRef(loc);
  now.current = loc;
  const show = (L: typeof import("leaflet"), map: LMap) => {
    const l = now.current;
    const m = live.current;
    if (!l || !m) return;
    if (!m.pin) {
      m.pin = L.marker([l.lat, l.lng], { draggable: true, keyboard: false, title: "Kitchen pin", icon: L.divIcon({ className: "gs-pin-wrap", iconSize: [22, 22], html: '<span class="gs-pin small">K</span>' }) }).addTo(map);
      m.pin.on("dragend", () => { const p = m.pin!.getLatLng(); void byHand(p.lat, p.lng); });
      map.setView([l.lat, l.lng], 16, { animate: false });
    } else if (m.pin.getLatLng().lat !== l.lat || m.pin.getLatLng().lng !== l.lng) {
      m.pin.setLatLng([l.lat, l.lng]);
      map.panTo([l.lat, l.lng], { animate: false });
    }
  };
  useEffect(() => { if (live.current) show(live.current.L, live.current.map); }, [loc?.lat, loc?.lng]);

  const useMine = async () => {
    setError(null);
    try {
      const f = await currentFix();
      await change.current({ lat: f.lat, lng: f.lng, accuracy: f.accuracy, at: new Date().toISOString() });
    } catch {
      setError("Could not get the phone's location. Allow location, or tap the map to place the pin.");
    }
  };

  return (
    <section className="ui-group" aria-label="Location">
      <h2>Location</h2>
      <div className="ui-map"><div ref={box} className="ui-map-box" role="application" aria-label="Kitchen map" />{TILES && <span className="ui-map-credit">© OpenStreetMap contributors</span>}</div>
      <button type="button" className="ui-btn ghost" onClick={() => void useMine()}>Use my phone's location here</button>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {loc ? <p className="ui-meta mono" data-testid="location-line">{locationLine(loc)}</p> : <p className="ui-meta">No location yet. Nearest rider cannot be picked.</p>}
    </section>
  );
}
