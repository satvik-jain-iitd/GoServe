// The founder's screen (story A2): who may use the system, and which kitchens exist. Only an admin sees it; row level security enforces that too.
import { useCallback, useEffect, useState } from "react";
import { addKitchen, addPerson, isAdmin, listKitchens, listPeople, parsePins, removePerson, type KitchenRow, type Person, type PersonKind } from "../lib/admin";
import { kitchenProblem } from "../lib/validate";
import { ensureSession, getClient } from "../lib/supabase";
import { AdminMenu } from "./AdminMenu";
import { AdminNumbers } from "./AdminNumbers";
import { AdminOrders } from "./AdminOrders";
import { Button } from "../ui";

type Tab = "kitchens" | "staff" | "menu" | "orders" | "numbers";

export function AdminScreen() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("kitchens");
  const [kitchens, setKitchens] = useState<KitchenRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", pins: "", opensAt: "", closesAt: "" });
  const [who, setWho] = useState<{ email: string; kind: PersonKind; kitchen: string }>({ email: "", kind: "kitchen", kitchen: "" });

  const load = useCallback(async () => {
    try {
      await ensureSession();
      const c = getClient();
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

  if (allowed === null) return <section><h2>Admin</h2><p>Loading…</p></section>;
  if (!allowed) return <section><h2>Admin</h2><p role="status">Not allowed. Sign in with an admin Google account.</p>{error && <p role="alert" className="error">{error}</p>}</section>;

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

  return (
    <section>
      <h2>Admin</h2>
      <div role="tablist" aria-label="Admin">
        {(["kitchens", "menu", "orders", "numbers", "staff"] as const).map((t) => (
          <button key={t} role="tab" type="button" className={tab === t ? "btn" : "btn ghost"} aria-selected={tab === t} onClick={() => { setError(null); setTab(t); }}>
            {t === "kitchens" ? "Kitchens" : t === "menu" ? "Menu" : t === "orders" ? "Orders" : t === "numbers" ? "Numbers" : "Staff"}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {tab === "kitchens" && (
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
      {tab === "orders" && <AdminOrders kitchens={kitchens} onError={setError} />}
      {tab === "numbers" && <AdminNumbers />}
      {tab === "menu" && <AdminMenu kitchens={kitchens} onError={setError} />}
      {tab === "staff" && (
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
  );
}
