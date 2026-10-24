// The rider app's top bar (story A5): the online switch, and the location while online. A user with no rider row sees why and no deliveries.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getRider, sendLocation, setOnline, shouldSendLocation, type RiderRow } from "../lib/rider";
import { ensureSession, getClient } from "../lib/supabase";
import { Button } from "../ui";

export function RiderGate({ children }: { children: ReactNode }) {
  const [rider, setRider] = useState<RiderRow | null | undefined>(undefined);   // undefined: still loading
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSent = useRef<number | null>(null);

  useEffect(() => {
    ensureSession().then(async (id) => { setUid(id); setRider(await getRider(getClient(), id)); }, () => setRider(null))
      .catch(() => { setError("Could not load your rider details. Check your connection."); setRider(null); });
  }, []);

  // While online, the browser reports the position; it is saved at once the first time and then every 30 seconds.
  const online = rider?.online === true;
  useEffect(() => {
    if (!online || !uid || !("geolocation" in navigator)) return;
    lastSent.current = null;
    const watch = navigator.geolocation.watchPosition((p) => {
      if (!shouldSendLocation(lastSent.current, Date.now())) return;
      lastSent.current = Date.now();
      void sendLocation(getClient(), p.coords.latitude, p.coords.longitude);
    }, () => {}, { enableHighAccuracy: true, maximumAge: 10_000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [online, uid]);

  if (rider === undefined) return <p>Loading…</p>;
  if (!rider) return <section><h2>Rider</h2><p role="status">This account is not a rider. Ask the admin to add you, then sign in with Google.</p>{error && <p role="alert" className="error">{error}</p>}</section>;
  const flip = async () => {
    if (!uid) return;
    const next = !rider.online;
    setError(null);
    if (await setOnline(getClient(), uid, next)) setRider({ ...rider, online: next });
    else setError("Could not change your status. Try again.");
  };
  return (
    <>
      <p role="status" className="notice">{online ? "You are online" : "You are offline"}{" "}
        <Button onClick={() => void flip()}>{online ? "Go offline" : "Go online"}</Button>
      </p>
      {error && <p role="alert" className="error">{error}</p>}
      {children}
    </>
  );
}
