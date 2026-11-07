// The Ops app is for admins only (story A4): anyone else sees "Not allowed". An admin sees the day's numbers above the ops screen.
import { useEffect, useState, type ReactNode } from "react";
import { claimInvites, isAdmin } from "../lib/admin";
import { ensureSession, getClient } from "../lib/supabase";
import { AdminNumbers } from "./AdminNumbers";

export function AdminGate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  // story #968: an admin invite waiting for this email is claimed before the check
  useEffect(() => { ensureSession().then(async () => { await claimInvites(getClient()); return isAdmin(getClient()); }).then(setAllowed, () => setAllowed(false)); }, []);
  if (allowed === null) return <p>Loading…</p>;
  if (!allowed) return <p role="status">Not allowed. Sign in with an admin Google account.</p>;
  return <><AdminNumbers />{children}</>;
}
