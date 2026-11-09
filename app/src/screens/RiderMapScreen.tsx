// Story 1053 (board T5-RiderMapFull): the rider on a full-screen, view-only map: Back, a Live pill, the card (order, "<name> is 1.2 km away", the door time, Call the rider).
// No pin to set. The phone's own place is a brown dot only when location is already allowed; this screen never asks for it.
import { useEffect, useState } from "react";
import { RiderMap, MAP_ATTRIBUTION } from "./RiderMap";
import { distanceText, lastSeenText, agoText, type Point } from "../lib/riderMap";
import { useNowOnline } from "../lib/useNowOnline";
import type { LatLng } from "../lib/riderTrack";

type Props = { t: { kitchen: LatLng; you: LatLng; rider: Point; name: string; phone: string | null }; orderNo: string; door: string | null; onBack: () => void; onCall?: () => void };

export function RiderMapScreen({ t, orderNo, door, onBack, onCall }: Props) {
  const { now, online } = useNowOnline();
  const [here, setHere] = useState<LatLng | null>(null);
  useEffect(() => {
    let watch: number | null = null;
    let gone = false;
    void navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((perm) => {
      if (gone || perm.state !== "granted" || !("geolocation" in navigator)) return;
      watch = navigator.geolocation.watchPosition((p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }), () => undefined, { enableHighAccuracy: true });
    }).catch(() => undefined);
    return () => { gone = true; if (watch !== null) navigator.geolocation.clearWatch(watch); };
  }, []);
  return (
    <section className="ui-pinmap" role="region" aria-label="Rider on the map">
      <RiderMap kitchen={t.kitchen} you={t.you} rider={t.rider} offline={!online} full here={here} name={t.name} />
      <div className="ui-pinmap-top">
        <button type="button" className="ui-pinmap-back" aria-label="Back to your order" onClick={onBack}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg></button>
        <span className="ui-livepill"><span aria-hidden="true" className="ui-live-dot" />Live</span>
      </div>
      <div className="ui-pinmap-card">
        <span className="mono ui-pinmap-kicker">Order {orderNo} · On the way</span>
        <span className="ui-pinmap-place"><span aria-hidden="true" className="ui-bigdot" /><span className="ui-pinmap-name">{t.name} is {distanceText(t.rider.lat, t.rider.lng, t.you.lat, t.you.lng)} away</span></span>
        {online
          ? <span className="ui-pinmap-addr">{door ? `At your door by ${door} · ` : ""}updated {agoText(t.rider.at, now)}</span>
          : <span className="ui-pinmap-addr"><span className="ui-chip-warn">No connection</span> {lastSeenText(t.rider.at, now)}</span>}
        {t.phone && <a href={`tel:${t.phone}`} className="ui-btn ghost big" onClick={onCall}>Call the rider</a>}
        <span className="mono ui-pinmap-credit">{MAP_ATTRIBUTION}</span>
      </div>
    </section>
  );
}
