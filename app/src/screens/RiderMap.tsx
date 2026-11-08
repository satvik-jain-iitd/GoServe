// Story #691 (boards T2 and T3): the rider on a map. Leaflet is loaded here and nowhere else, so the shell does not carry it.
// Tiles come from the build's VITE_MAP_TILES; with none the map still draws K, You, the rider and the dashed route on the plain surface (prod, until the PMTiles test).
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker, Polyline } from "leaflet";
import { tileUrl } from "../lib/riderMap";
import type { LatLng } from "../lib/riderTrack";

type Props = { kitchen: LatLng; you: LatLng; rider: LatLng; offline: boolean; full?: boolean; here?: LatLng | null };   // full: story 1053, the whole screen, view-only, the card keeps the lower part free
const TILES = tileUrl(import.meta.env.VITE_MAP_TILES);
export const MAP_ATTRIBUTION = "© OpenStreetMap contributors";

export function RiderMap({ kitchen, you, rider, offline, full, here }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<{ map: LMap; rider: Marker; route: Polyline; dot: Marker | null; L: typeof import("leaflet") } | null>(null);
  const [ready, setReady] = useState(false);
  const now = useRef({ kitchen, you, rider });
  now.current = { kitchen, you, rider };

  const fit = (map: LMap, route: Polyline) => map.fitBounds(route.getBounds(), full ? { paddingTopLeft: [40, 120], paddingBottomRight: [40, 360], animate: false } : { padding: [32, 32], animate: false });

  useEffect(() => {
    let gone = false;
    void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      if (gone || !box.current) return;
      const n = now.current;
      const map = L.map(box.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
      if (TILES) L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
      const pin = (label: string, text: string, cls = "") => L.marker([0, 0], { interactive: false, keyboard: false, icon: L.divIcon({ className: "gs-pin-wrap", iconSize: [28, 28], html: `<span class="gs-pin ${cls}" role="img" aria-label="${label}">${text}</span>` }) });
      pin("Kitchen", "K").setLatLng([n.kitchen.lat, n.kitchen.lng]).addTo(map);
      pin(full ? "Delivery" : "You", full ? "D" : "You").setLatLng([n.you.lat, n.you.lng]).addTo(map);
      const marker = pin("Rider", "", "rider").setLatLng([n.rider.lat, n.rider.lng]).addTo(map);
      const route = L.polyline([[n.kitchen.lat, n.kitchen.lng], [n.rider.lat, n.rider.lng], [n.you.lat, n.you.lng]], { className: "gs-route", dashArray: "6 6", weight: 3, interactive: false }).addTo(map);
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
    m.route.setLatLngs([[kitchen.lat, kitchen.lng], [rider.lat, rider.lng], [you.lat, you.lng]]);
    fit(m.map, m.route);
  }, [kitchen.lat, kitchen.lng, you.lat, you.lng, rider.lat, rider.lng]);

  useEffect(() => {   // the phone's own place: a brown dot, only when the screen was given it
    const m = live.current;
    if (!m || !here) return;
    if (!m.dot) m.dot = m.L.marker([here.lat, here.lng], { interactive: false, keyboard: false, icon: m.L.divIcon({ className: "gs-here-dot", iconSize: [26, 26], iconAnchor: [13, 13], html: "<i></i>" }) }).addTo(m.map);
    else m.dot.setLatLng([here.lat, here.lng]);
  }, [here?.lat, here?.lng, ready]);

  return (
    <div className={`ui-map${full ? " full" : ""}`} data-offline={offline ? "true" : undefined}>
      <div ref={box} className="ui-map-box" />
      {TILES && !full && <span className="ui-map-credit">{MAP_ATTRIBUTION}</span>}
    </div>
  );
}
