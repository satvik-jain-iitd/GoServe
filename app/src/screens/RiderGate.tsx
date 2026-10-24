// The rider app's door on the Ink v3 boards R1 and R2 (story H11, #194; story A5): sign in, the gate, and while online the location every 30 seconds.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getRider, sendLocation, setOnline, shouldSendLocation, type RiderGateState, type RiderRow } from "../lib/rider";
import { ensureSession, getClient } from "../lib/supabase";
import { SignIn } from "./SignIn";
import { Skeleton } from "../ui";

export function RiderGate({ children }: { children: (gate: RiderGateState) => ReactNode }) {
  const [rider, setRider] = useState<RiderRow | null | undefined>(undefined);   // undefined: still loading
  const [uid, setUid] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSent = useRef<number | null>(null);

  useEffect(() => {
    ensureSession().then(async (id) => {
      setUid(id);
      try { const { data } = await getClient().auth.getUser(); setAnonymous(data.user?.is_anonymous !== false); } catch { /* unknown: treat as not signed in */ }
      setRider(await getRider(getClient(), id));
    }, () => setRider(null))
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

  const signOut = async () => { try { await getClient().auth.signOut(); } catch { /* offline */ } window.location.reload(); };
  if (rider === undefined) return <><header className="ui-head"><h1>Deliveries</h1></header><div className="ui-pad"><Skeleton lines={3} /></div></>;
  if (!rider) return (   // R1 when there is no Google sign-in yet, R2 when the account is not on the rider list
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Rider app · one delivery at a time</p>
      </header>
      <div className="ui-slip" role="group" aria-label={anonymous ? "Sign in" : "Not a rider"}>
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>Rider</span><span>{anonymous ? "Google" : "Signed in"}</span></div>
          {anonymous ? (
            <>
              <h2 className="ui-slip-title">Sign in to ride</h2>
              <p className="ui-meta">Only riders the admin has added can sign in. No password, no form.</p>
              <SignIn mode="signin" />
            </>
          ) : (
            <>
              <h2 className="ui-slip-title">Not a rider yet</h2>
              <p role="status">This Google account is not on the rider list. Ask the admin to add it, then open this page again.</p>
              <button type="button" className="ui-btn big" onClick={() => window.location.reload()}>Check again</button>
              <button type="button" className="ui-btn ghost big" onClick={() => void signOut()}>Sign out</button>
            </>
          )}
          {error && <p role="alert" className="ui-field-error">{error}</p>}
        </div>
      </div>
      <footer className="ui-landing-foot"><p className="ui-kicker">No app to install · works in the browser</p></footer>
    </section>
  );
  const flip = async () => {
    if (!uid) return;
    const next = !rider.online;
    setError(null);
    if (await setOnline(getClient(), uid, next)) setRider({ ...rider, online: next });
    else setError("Could not change your status. Try again.");
  };
  return (
    <>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {children({ name: rider.name, phone: rider.phone ?? null, online, flip, signOut })}
    </>
  );
}
