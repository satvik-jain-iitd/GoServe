// Story #691 (boards T2 and T3): the rider on a map. Leaflet is loaded here and nowhere else, so the shell does not carry it.
// Tiles come from the build's VITE_MAP_TILES; with none the map still draws K, You, the rider and the dashed route on the plain surface (prod, until the PMTiles test).
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker, Polyline } from "leaflet";
import { tileUrl } from "../lib/riderMap";
import type { LatLng } from "../lib/riderTrack";

type Props = { you: LatLng | null; rider: LatLng; offline: boolean; full?: boolean; here?: LatLng | null; name?: string };   // full: story 1053, the whole screen, view-only, the card keeps the lower part free
const TILES = tileUrl(import.meta.env.VITE_MAP_TILES);
export const MAP_ATTRIBUTION = "© OpenStreetMap contributors";

export function RiderMap({ you, rider, offline, full, here, name }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<{ map: LMap; rider: Marker; route: Polyline; dot: Marker | null; L: typeof import("leaflet") } | null>(null);
  const [ready, setReady] = useState(false);
  const now = useRef({ you, rider });
  now.current = { you, rider };
  // Story 1497: `you` is the order's own drop point. An order with none has no Home mark and no line; the map then shows the rider alone.
  const line = (r: LatLng, y: LatLng | null): [number, number][] => (y ? [[r.lat, r.lng], [y.lat, y.lng]] : [[r.lat, r.lng]]);

  const fit = (map: LMap, route: Polyline) => map.fitBounds(route.getBounds(), full ? { paddingTopLeft: [40, 120], paddingBottomRight: [40, 360], animate: false, maxZoom: 17 } : { padding: [32, 32], animate: false, maxZoom: 17 });

  useEffect(() => {
    let gone = false;
    void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      if (gone || !box.current) return;
      const n = now.current;
      const map = L.map(box.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
      if (TILES) L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
      // Story 1053 (board T5): the full map has no kitchen mark; the delivery point is a "Home" pin, the rider a green dot with the name, the phone a "You" dot. Story 1497: there is no map in the page any more, so the K and You marks of #691 are gone.
      const lab = (label: string, html: string, w: number, h: number, ax: number, ay: number) => L.marker([0, 0], { interactive: false, keyboard: false, icon: L.divIcon({ className: "gs-pin-wrap", iconSize: [w, h], iconAnchor: [ax, ay], html: `<span class="gs-lab" role="img" aria-label="${label}"><b>${label === "Rider" ? (name ?? "Rider") : label}</b>${html}</span>` }) });
      const HOME_PIN = '<svg width="30" height="40" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="currentColor"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>';
      if (n.you) lab("Home", HOME_PIN, 80, 60, 40, 60).setLatLng([n.you.lat, n.you.lng]).addTo(map);
      const marker: Marker = lab("Rider", '<i class="gs-rdot"></i>', 80, 44, 40, 38).setLatLng([n.rider.lat, n.rider.lng]).addTo(map);
      const route: Polyline = L.polyline(line(n.rider, n.you), { className: "gs-route", dashArray: "6 6", weight: 3, interactive: false }).addTo(map);
      fit(map, route);
      live.current = { map, rider: marker, route, dot: null, L };
      setReady(true);
    });
    return () => { gone = true; live.current?.map.remove(); live.current = null; };
  }, []);

  useEffect(() => {   // a new ping: the rider moves, the dashed route follows, the view keeps all three in sight
    const m = live.current;
    if (!m) return;
    m.rider.setLatLng([rider.lat, rider.lng]);
    m.route.setLatLngs(line(rider, you));
    fit(m.map, m.route);
  }, [you?.lat, you?.lng, rider.lat, rider.lng]);

  useEffect(() => {   // the phone's own place: a brown dot, only when the screen was given it
    const m = live.current;
    if (!m || !here) return;
    if (!m.dot) m.dot = m.L.marker([here.lat, here.lng], { interactive: false, keyboard: false, icon: m.L.divIcon({ className: "gs-here-dot", iconSize: [60, 44], iconAnchor: [30, 31], html: `${full ? '<b class="gs-lab-you">You</b>' : ""}<i></i>` }) }).addTo(m.map);
    else m.dot.setLatLng([here.lat, here.lng]);
  }, [here?.lat, here?.lng, ready]);

  return (
    <div className={`ui-map${full ? " full" : ""}`} data-offline={offline ? "true" : undefined}>
      <div ref={box} className="ui-map-box" />
      {TILES && !full && <span className="ui-map-credit">{MAP_ATTRIBUTION}</span>}
    </div>
  );
}
