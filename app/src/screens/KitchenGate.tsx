// The kitchen app's door (story H3): only a kitchen's staff see its orders. Any other account is told so, never shown an empty screen.
import { useEffect, useState, type ReactNode } from "react";
import { myKitchen } from "../lib/session";
import { ensureSession, getClient } from "../lib/supabase";

export function KitchenGate({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<boolean | undefined>(undefined);   // undefined: still loading
  useEffect(() => {
    ensureSession().then((id) => myKitchen(getClient(), id)).then((k) => setStaff(!!k), () => setStaff(false));
  }, []);
  if (staff === undefined) return <p>Loading…</p>;
  if (!staff) return <section><h2>Kitchen</h2><p role="status">This account is not kitchen staff. Ask the admin.</p></section>;
  return <>{children}</>;
}
