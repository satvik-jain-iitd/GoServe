// Story 1053: the clock (10 s) and the connection of the tracker, shared by the rider row and the full-screen map.
import { useEffect, useState } from "react";

export function useNowOnline(): { now: number; online: boolean } {
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    const up = () => { setOnline(true); setNow(Date.now()); }, down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { clearInterval(tick); window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return { now, online };
}
