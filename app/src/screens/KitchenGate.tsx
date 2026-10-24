// The kitchen app's door on the Ink v3 boards K1 and K2 (story H11, #194; story H3): only a kitchen's staff see its tickets. The gate also holds the open switch.
import { useEffect, useState, type ReactNode } from "react";
import { hhmmOf } from "../lib/kitchen";
import { myKitchen } from "../lib/session";
import { ensureSession, getClient } from "../lib/supabase";
import { SignIn } from "./SignIn";
import { Skeleton } from "../ui";

export type KitchenGateState = { kitchenId: string; name: string; open: boolean | null; closesAt: string | null; flipOpen: () => Promise<void>; signOut: () => void };   // open null: the row could not be read
type Row = { name: string; open: boolean | null; closes_at: string | null };

export function KitchenGate({ children }: { children: (gate: KitchenGateState) => ReactNode }) {
  const [kitchenId, setKitchenId] = useState<string | null | undefined>(undefined);   // undefined: still loading
  const [row, setRow] = useState<Row | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ensureSession().then(async (id) => {
      try { const { data } = await getClient().auth.getUser(); setAnonymous(data.user?.is_anonymous !== false); } catch { /* unknown: treat as not signed in */ }
      const k = await myKitchen(getClient(), id);
      if (k) {
        const { data, error } = await getClient().from("kitchens").select("name, open, closes_at").eq("id", k).limit(1);
        const r = data?.[0] as Partial<Row> | undefined;
        setRow({ name: r?.name ?? "Your kitchen", open: error || !r ? null : r.open !== false, closes_at: r?.closes_at ?? null });   // unknown stays unknown: the switch is disabled
      }
      setKitchenId(k);
    }, () => setKitchenId(null)).catch(() => { setError("Could not load your kitchen. Check your connection."); setKitchenId(null); });
  }, []);
  const signOut = async () => { try { await getClient().auth.signOut(); } catch { /* offline */ } window.location.reload(); };
  if (kitchenId === undefined) return <><header className="ui-head"><h1>New</h1></header><div className="ui-pad"><Skeleton lines={3} /></div></>;
  if (!kitchenId || !row) return (   // K1 when there is no Google sign-in yet, K2 when the account is not on the staff list
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Kitchen app · tickets in, food out</p>
      </header>
      <div className="ui-slip" role="group" aria-label={anonymous ? "Sign in" : "Not kitchen staff"}>
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>Kitchen</span><span>{anonymous ? "Google" : "Signed in"}</span></div>
          {anonymous ? (
            <>
              <h2 className="ui-slip-title">Sign in to cook</h2>
              <p className="ui-meta">Only the staff the admin has added can sign in. No password, no form.</p>
              <SignIn mode="signin" />
            </>
          ) : (
            <>
              <h2 className="ui-slip-title">Not kitchen staff yet</h2>
              <p role="status">This account is not kitchen staff. Ask the admin to add it to your kitchen, then open this page again.</p>
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
  const flipOpen = async () => {
    setError(null);
    if (row.open === null) return;
    const { error: failed } = await getClient().rpc("set_kitchen_open", { p_kitchen: kitchenId, p_open: !row.open });
    if (failed) setError("Could not change the kitchen. Try again.");
    else setRow({ ...row, open: !row.open });
  };
  return (
    <>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {children({ kitchenId, name: row.name, open: row.open, closesAt: hhmmOf(row.closes_at), flipOpen, signOut })}
    </>
  );
}
