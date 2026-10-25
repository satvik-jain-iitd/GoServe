// The founder's app on the Ink v3 boards A1 to A4 and A8 (story H12, #195; story A2): the gate, Orders, City (the kitchen, staff and menu tools until the A5 to A7 layer), Numbers, Simulator (H7, #190).
import { useCallback, useEffect, useState } from "react";
import { isAdmin, listKitchens, listPeople, listRiders, type KitchenRow, type Person, type RiderListRow } from "../lib/admin";
import { ensureSession, getClient } from "../lib/supabase";
import { AdminCity } from "./AdminCity";
import { AdminDecisions } from "./AdminDecisions";
import { AdminNumbers } from "./AdminNumbers";
import { AdminOrders } from "./AdminOrders";
import { AdminSim } from "./AdminSim";
import { SignIn } from "./SignIn";
import { StaffLanding, Tabs } from "../ui";

type Tab = "orders" | "city" | "numbers" | "sim";
type CityView = { kind: "list" } | { kind: "kitchen"; id: string } | { kind: "add" };

export function AdminScreen() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [tab, setTab] = useState<Tab>("orders");
  const [cityView, setCityView] = useState<CityView>({ kind: "list" });
  const [riders, setRiders] = useState<RiderListRow[] | null>([]);   // null: the riders could not be read
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [count, setCount] = useState({ live: 0, total: 0 });
  const onCount = useCallback((live: number, total: number) => setCount({ live, total }), []);
  const [kitchens, setKitchens] = useState<KitchenRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await ensureSession();
      const c = getClient();
      try { const { data } = await c.auth.getUser(); setAnonymous(data.user?.is_anonymous !== false); } catch { /* unknown: treat as not signed in */ }
      const ok = await isAdmin(c);
      setAllowed(ok);
      if (!ok) return;
      setKitchens(await listKitchens(c));
      setPeople(await listPeople(c));
      setRiders(await listRiders(c).catch(() => null));   // unreadable stays visible as unreadable, not as "all offline"
    } catch {
      setError("Could not load. Check your connection and try again.");
      setAllowed((a) => a ?? false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (allowed === null) return <><header className="ui-head"><h1>Orders</h1></header><div className="ui-pad"><p className="ui-meta">Loading…</p></div></>;
  if (!allowed) return (   // A1 when there is no Google sign-in yet, A2 when the account is not on the admin list
    <StaffLanding kicker="Admin · the city in one hand" app="Admin" right={anonymous ? "Google" : "Signed in"} label={anonymous ? "Sign in" : "Not an admin"} error={error}>
          {anonymous ? (
            <>
              <h2 className="ui-slip-title">Sign in to run the city</h2>
              <p className="ui-meta">Only the admin accounts on the list can sign in. No password, no form.</p>
              <SignIn mode="signin" />
            </>
          ) : (
            <>
              <h2 className="ui-slip-title">Not an admin account</h2>
              <p role="status">This Google account is not on the admin list. Sign in with the admin account, or ask an admin to add this one.</p>
              <button type="button" className="ui-btn big" onClick={async () => { try { await getClient().auth.signOut(); } catch { /* offline */ } window.location.reload(); }}>Sign out</button>
            </>
          )}
    </StaffLanding>
  );

  const head = tab === "orders" ? { h: "Orders", meta: `Today · ${count.total}` } : tab === "city" ? { h: "City", meta: "Delhi" } : tab === "sim" ? { h: "Simulator", meta: "Synthetic city" } : { h: "Numbers", meta: `Today · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` };
  const ordersView = <AdminOrders kitchens={kitchens} onError={setError} open={openOrder} onOpen={setOpenOrder} onCount={onCount} />;
  if (tab === "orders" && openOrder) return <>{error && <p role="alert" className="ui-note error">{error}</p>}{ordersView}</>;   // A4 sits over the tabs
  const cityScreen = <AdminCity kitchens={kitchens} people={people} riders={riders} onError={setError} reload={load} view={cityView} onView={setCityView} />;
  if (tab === "city" && cityView.kind !== "list") return <>{error && <p role="alert" className="ui-note error">{error}</p>}{cityScreen}</>;   // A6 and A7 sit over the tabs
  return (
    <>
      <header className="ui-head"><h1>{head.h}</h1><span className="meta">{head.meta}</span></header>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {tab === "orders" && ordersView}
      {tab === "numbers" && <div className="ui-scroll"><AdminNumbers live={count.live} kitchens={kitchens} /><div className="ui-pad"><AdminDecisions /></div></div>}
      {tab === "city" && cityScreen}
      {tab === "sim" && <div className="ui-scroll"><AdminSim /></div>}
      <Tabs current={tab} onPick={(t) => { setError(null); setTab(t); }} tabs={[{ key: "orders", label: "Orders", icon: "orders", badge: count.live }, { key: "city", label: "City", icon: "city" }, { key: "numbers", label: "Numbers", icon: "numbers" }, { key: "sim", label: "Simulator", icon: "sim" }]} />
    </>
  );
}
