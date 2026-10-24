// The founder's app on the Ink v3 boards A1 to A4 and A8 (story H12, #195; story A2): the gate, Orders, City (the kitchen, staff and menu tools until the A5 to A7 layer), Numbers.
import { useCallback, useEffect, useState } from "react";
import { addKitchen, addPerson, isAdmin, listKitchens, listPeople, parsePins, removePerson, type KitchenRow, type Person, type PersonKind } from "../lib/admin";
import { kitchenProblem } from "../lib/validate";
import { ensureSession, getClient } from "../lib/supabase";
import { AdminMenu } from "./AdminMenu";
import { AdminNumbers } from "./AdminNumbers";
import { AdminOrders } from "./AdminOrders";
import { SignIn } from "./SignIn";
import { Button, StaffLanding, Tabs } from "../ui";

type Tab = "orders" | "city" | "numbers";
type CityTab = "kitchens" | "staff" | "menu";

export function AdminScreen() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [tab, setTab] = useState<Tab>("orders");
  const [city, setCity] = useState<CityTab>("kitchens");
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [count, setCount] = useState({ live: 0, total: 0 });
  const onCount = useCallback((live: number, total: number) => setCount({ live, total }), []);
  const [kitchens, setKitchens] = useState<KitchenRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", pins: "", opensAt: "", closesAt: "" });
  const [who, setWho] = useState<{ email: string; kind: PersonKind; kitchen: string }>({ email: "", kind: "kitchen", kitchen: "" });

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

  const submitKitchen = async () => {
    const problem = kitchenProblem(form);
    if (problem) return setError(problem);
    const { pins } = parsePins(form.pins);
    const failed = await addKitchen(getClient(), { name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim(), pins, opensAt: form.opensAt, closesAt: form.closesAt });
    setError(failed);
    if (!failed) { setForm({ name: "", address: "", phone: "", pins: "", opensAt: "", closesAt: "" }); await load(); }
  };
  const submitPerson = async () => {
    const failed = await addPerson(getClient(), who.email, who.kind, who.kitchen || null);
    setError(failed);
    if (!failed) { setWho({ ...who, email: "" }); await load(); }
  };
  const remove = async (p: Person) => {
    const failed = await removePerson(getClient(), p);
    setError(failed);
    if (!failed) await load();
  };

  const head = tab === "orders" ? { h: "Orders", meta: `Today · ${count.total}` } : tab === "city" ? { h: "City", meta: "Delhi" } : { h: "Numbers", meta: `Today · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` };
  const ordersView = <AdminOrders kitchens={kitchens} onError={setError} open={openOrder} onOpen={setOpenOrder} onCount={onCount} />;
  if (tab === "orders" && openOrder) return <>{error && <p role="alert" className="ui-note error">{error}</p>}{ordersView}</>;   // A4 sits over the tabs
  return (
    <>
      <header className="ui-head"><h1>{head.h}</h1><span className="meta">{head.meta}</span></header>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {tab === "orders" && ordersView}
      {tab === "numbers" && <div className="ui-scroll"><AdminNumbers live={count.live} kitchens={kitchens} /></div>}
      {tab === "city" && <div className="ui-scroll ui-city">
      <div role="tablist" aria-label="City" className="ui-chips ui-pad">
        {(["kitchens", "staff", "menu"] as const).map((t) => (
          <button key={t} role="tab" type="button" className={city === t ? "ui-chip on" : "ui-chip"} aria-selected={city === t} onClick={() => { setError(null); setCity(t); }}>
            {t === "kitchens" ? "Kitchens" : t === "menu" ? "Menu" : "Staff"}
          </button>
        ))}
      </div>
      <section className="ui-pad">
      {city === "kitchens" && (
        <>
          <ul className="tickets">
            {kitchens.map((k) => (
              <li key={k.id} className="ticket">
                <strong>{k.name}</strong>
                <p className="note">{k.address ?? "No address"} · {k.phone ?? "No phone"}</p>
                <p className="note">Pin codes: {k.pin_codes.length ? k.pin_codes.join(", ") : "none"} · {k.open ? "Open" : "Closed"}{k.opens_at && k.closes_at ? ` · ${k.opens_at.slice(0, 5)} to ${k.closes_at.slice(0, 5)}` : ""}</p>
              </li>
            ))}
          </ul>
          <h3>Add a kitchen</h3>
          <label>Kitchen name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label>Phone<input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Pin codes<input value={form.pins} placeholder="110016, 110017" onChange={(e) => setForm({ ...form, pins: e.target.value })} /></label>
          <label>Opens at<input type="time" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} /></label>
          <label>Closes at<input type="time" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></label>
          <Button onClick={() => void submitKitchen()}>Add kitchen</Button>
        </>
      )}
      {city === "menu" && <AdminMenu kitchens={kitchens} onError={setError} />}
      {city === "staff" && (
        <>
          <ul className="tickets">
            {people.map((p) => (
              <li key={`${p.kind}-${p.user_id}-${p.kitchen_id ?? ""}`} className="ticket">
                <strong>{p.email ?? p.user_id}</strong>
                <p className="note">{p.kind === "kitchen" ? `Kitchen staff, ${p.kitchen_name ?? ""}` : p.kind === "rider" ? "Rider" : "Admin"}</p>
                <Button variant="ghost" aria-label={`Remove ${p.email ?? p.user_id}`} onClick={() => void remove(p)}>Remove</Button>
              </li>
            ))}
          </ul>
          <h3>Add a person</h3>
          <label>Email<input type="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} /></label>
          <label>Role
            <select value={who.kind} onChange={(e) => setWho({ ...who, kind: e.target.value as PersonKind })}>
              <option value="kitchen">Kitchen staff</option><option value="rider">Rider</option><option value="admin">Admin</option>
            </select>
          </label>
          {who.kind === "kitchen" && (
            <label>Kitchen
              <select aria-label="Kitchen" value={who.kitchen} onChange={(e) => setWho({ ...who, kitchen: e.target.value })}>
                <option value="">Pick a kitchen</option>
                {kitchens.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
          )}
          <Button onClick={() => void submitPerson()}>Add person</Button>
        </>
      )}
      </section>
      </div>}
      <Tabs current={tab} onPick={(t) => { setError(null); setTab(t); }} tabs={[{ key: "orders", label: "Orders", icon: "orders", badge: count.live }, { key: "city", label: "City", icon: "city" }, { key: "numbers", label: "Numbers", icon: "numbers" }]} />
    </>
  );
}
