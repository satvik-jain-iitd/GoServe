// The City of the admin app on the Ink v3 boards A5 (city), A6 (one kitchen) and A7 (add a kitchen) (story H12, #195; stories A2, A3, A5).
import { useState } from "react";
import { DangerSheet } from "../ui";
import { addKitchen, addPerson, cancelInvite, inviteLink, parsePins, removeKitchen, removePerson, locOf, setKitchenLocation, type Invite, type KitchenRow, type Loc, type Person, type PersonKind, type RiderListRow } from "../lib/admin";
import { kitchenProblem } from "../lib/validate";
import { getClient } from "../lib/supabase";
import { AdminMenu } from "./AdminMenu";
import { KitchenLocation } from "./KitchenLocation";

type View = { kind: "list" } | { kind: "kitchen"; id: string } | { kind: "add" };
type Props = { kitchens: KitchenRow[]; people: Person[]; invites: Invite[]; riders: RiderListRow[] | null; onError: (m: string | null) => void; reload: () => Promise<void>; view: View; onView: (v: View) => void };
const EMPTY = { name: "", address: "", phone: "", pins: "", opensAt: "", closesAt: "", loc: null as Loc | null };
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
/** Open (serving), Closed (the switch is off today), Off (taken out of the system, active false). */
const stateOf = (k: KitchenRow): [string, string] => (!k.active ? ["Off", "error"] : k.open ? ["Open", "ready"] : ["Closed", "placed"]);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const BACK = <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>;

export function AdminCity({ kitchens, people, invites, riders, onError, reload, view, onView }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [addingPerson, setAddingPerson] = useState(false);
  const [who, setWho] = useState<{ email: string; kind: PersonKind; kitchen: string }>({ email: "", kind: "kitchen", kitchen: "" });
  const [invited, setInvited] = useState<{ email: string; kind: "kitchen" | "rider" } | null>(null);   // story 875: the "Invite ready" box
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);   // story 900, board A8: the confirm sheet of Remove this kitchen
  const [addError, setAddError] = useState<string | null>(null);   // story 885: the add-person line sits under the form, next to its button
  const invitesOf = (id: string) => invites.filter((i) => i.kind === "kitchen" && i.kitchen_id === id);
  const staffOf = (id: string) => people.filter((p) => p.kind === "kitchen" && p.kitchen_id === id);
  const firstName = (p: Person) => (p.email ?? p.user_id).split("@")[0];

  const submitKitchen = async () => {
    const problem = kitchenProblem(form);
    if (problem) return onError(problem);
    const { pins } = parsePins(form.pins);
    const failed = await addKitchen(getClient(), { name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim(), pins, opensAt: form.opensAt, closesAt: form.closesAt, loc: form.loc });
    onError(failed);
    if (!failed) { setForm(EMPTY); await reload(); onView({ kind: "list" }); }
  };
  const submitPerson = async () => {
    setInvited(null);
    setShareNote(null);
    setAddError(null);
    onError(null);
    const { error: failed, invited: wasInvited } = await addPerson(getClient(), who.email, who.kind, who.kitchen || null);
    setAddError(failed);
    if (failed) return;
    if (wasInvited && who.kind !== "admin") setInvited({ email: who.email.trim().toLowerCase(), kind: who.kind });   // the form stays open, with the box under it (board A-AddPerson-Invite)
    else { setWho({ ...who, email: "" }); setAddingPerson(false); }
    await reload();
  };
  const share = async () => {
    if (!invited) return;
    const url = inviteLink(invited.kind, window.location.origin);
    const text = invited.kind === "kitchen" ? "Open this link and tap Continue with Google to start in your kitchen on GoServe." : "Open this link and tap Continue with Google to start riding with GoServe.";
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: "GoServe", text, url }); return; } catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; /* the sheet failed: copy instead */ }
    }
    try { await navigator.clipboard.writeText(url); setShareNote("Link copied."); } catch { setShareNote(`Copy this link: ${url}`); }   // clipboard blocked: show it instead
  };
  const cancel = async (i: Invite) => {
    const failed = await cancelInvite(getClient(), i.id);
    onError(failed);
    if (!failed) await reload();
  };
  const inviteRow = (i: Invite) => (   // board A-Kitchen-Invite
    <div key={i.id} className="ui-row ui-row-static">
      <span className="ui-row-label"><span className="mono ui-invite-email">{i.email}</span><span className="ui-row-sub mono">Invited {day(i.created_at)} · not signed in yet</span></span>
      <span className="ui-row-acts"><span className="ui-tag placed">Invited</span><button type="button" className="ui-btn ghost icon ui-trash" aria-label={`Cancel the invite for ${i.email}`} title="Cancel invite" onClick={() => void cancel(i)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button></span>
    </div>
  );
  const remove = async (p: Person) => {
    if (!window.confirm(`Remove ${p.email ?? p.user_id}? They lose access at once.`)) return;   // one tap less than a mistake
    const failed = await removePerson(getClient(), p);
    onError(failed);
    if (!failed) await reload();
  };
  const removeButton = (p: Person) => <button type="button" className="ui-btn ghost small" aria-label={`Remove ${p.email ?? p.user_id}`} onClick={() => void remove(p)}>Remove</button>;

  if (view.kind === "add") return (   // A7
    <>
      <header className="ui-head">
        <button type="button" className="ui-back" aria-label="Back to city" onClick={() => onView({ kind: "list" })}>{BACK}</button>
        <h1>Add a kitchen</h1>
        <span className="meta">Delhi</span>
      </header>
      <div className="ui-scroll">
        <div className="ui-form ui-pad">
          <div className="ui-field"><label htmlFor="k-name">Kitchen name</label><input id="k-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="ui-field"><label htmlFor="k-addr">Address</label><input id="k-addr" type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="ui-field"><label htmlFor="k-phone">Phone</label><input id="k-phone" className="mono-input" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><span className="ui-meta mono">10 digits</span></div>
          <div className="ui-field"><label htmlFor="k-pins">Pin codes</label><input id="k-pins" className="mono-input" type="text" inputMode="numeric" value={form.pins} placeholder="110016, 110017" onChange={(e) => setForm({ ...form, pins: e.target.value })} /><span className="ui-meta mono">At least one · comma between pins</span></div>
          <KitchenLocation loc={form.loc} onChange={(loc) => setForm({ ...form, loc })} />
          <div className="ui-two">
            <div className="ui-field"><label htmlFor="k-open">Opens at</label><input id="k-open" className="mono-input" type="time" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} /></div>
            <div className="ui-field"><label htmlFor="k-close">Closes at</label><input id="k-close" className="mono-input" type="time" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></div>
          </div>
          <p className="ui-meta">A kitchen with no pin code never shows to a customer. You can add staff and dishes after saving.</p>
        </div>
      </div>
      <div className="ui-bottom"><button type="button" className="ui-btn big" onClick={() => void submitKitchen()}>Add kitchen</button></div>
    </>
  );
  const k = view.kind === "kitchen" ? kitchens.find((x) => x.id === view.id) ?? null : null;
  if (k) return (   // A6
    <>
      <header className="ui-head">
        <button type="button" className="ui-back" aria-label="Back to city" onClick={() => onView({ kind: "list" })}>{BACK}</button>
        <h1>{k.name}</h1>
        <span className={`ui-tag ${stateOf(k)[1]}`}>{stateOf(k)[0]}</span>
      </header>
      <div className="ui-scroll ui-today">
        <div className="ui-row ui-row-static"><span>Pin codes</span><span className="mono ui-row-sub">{k.pin_codes.length ? k.pin_codes.join(" · ") : "none"}</span></div>
        <div className="ui-row ui-row-static"><span>Hours</span><span className="mono ui-row-sub">{hhmm(k.opens_at) && hhmm(k.closes_at) ? `${hhmm(k.opens_at)} to ${hhmm(k.closes_at)}` : "Not set"}</span></div>
        <div className="ui-row ui-row-static"><span>Phone</span><span className="mono ui-row-sub">{k.phone ?? "Not set"}</span></div>
        <div className="ui-row ui-row-static"><span>Address</span><span className="ui-row-sub ui-right">{k.address ?? "Not set"}</span></div>
        <KitchenLocation loc={locOf(k)} onChange={async (loc) => { const failed = await setKitchenLocation(getClient(), k.id, loc); onError(failed); if (!failed) await reload(); }} />
        <section className="ui-group" aria-label="Staff">
          <h2>Staff <span className="mono">{staffOf(k.id).length}{invitesOf(k.id).length > 0 && ` · ${invitesOf(k.id).length} invited`}</span></h2>
          {staffOf(k.id).length === 0 && invitesOf(k.id).length === 0 && <p className="ui-meta">No staff yet. Add a person from the City tab.</p>}
          {staffOf(k.id).map((p) => <div key={p.user_id} className="ui-row ui-row-static"><span className="ui-row-label"><span>{firstName(p)}</span><span className="ui-row-sub mono">{p.email ?? p.user_id}</span></span>{removeButton(p)}</div>)}
          {invitesOf(k.id).map(inviteRow)}
        </section>
        <AdminMenu kitchenId={k.id} kitchenName={k.name} onError={onError} />
        {k.active && (
          <section className="ui-group" aria-label="Leaving GoServe">
            <h2>Leaving GoServe <span className="mono">Asks twice</span></h2>
            <button type="button" className="ui-row ui-row-tall" onClick={() => setRemoving(true)}>
              <span className="ui-row-label"><span className="ui-danger-text">Remove this kitchen</span><span className="ui-row-sub mono">Customers stop seeing it today. It stays in the city list as Off.</span></span>
              <span className="go" aria-hidden="true">›</span>
            </button>
          </section>
        )}
      </div>
      {removing && <RemoveSheet kitchen={k} onClose={() => setRemoving(false)} onRemoved={reload} />}
      {k.phone && <div className="ui-bottom"><a className="ui-btn big" href={`tel:${k.phone}`}>Call {k.name}</a></div>}
    </>
  );
  const open = kitchens.filter((x) => x.open && x.active).length;
  const riderPeople = people.filter((p) => p.kind === "rider");
  const known = riders ?? [];
  const online = known.filter((r) => r.online).length;
  const riderRows = [...known.map((r) => ({ key: r.user_id, name: r.name || riderPeople.find((p) => p.user_id === r.user_id)?.email || "Rider", sub: r.phone ?? riderPeople.find((p) => p.user_id === r.user_id)?.email ?? "", online: r.online, person: riderPeople.find((p) => p.user_id === r.user_id) ?? null })),
    ...riderPeople.filter((p) => !known.some((r) => r.user_id === p.user_id)).map((p) => ({ key: p.user_id, name: p.email ?? p.user_id, sub: riders ? "Not set up as a rider yet · add them again" : "", online: false, person: p }))];
  return (   // A5
    <div className="ui-scroll ui-today">
      <section className="ui-group" aria-label="Kitchens">
        <h2>Kitchens <span className="mono">{open} open · {kitchens.length - open} closed</span></h2>
        {kitchens.map((x) => (
          <button key={x.id} type="button" className="ui-row" aria-label={`Open kitchen ${x.name}`} onClick={() => onView({ kind: "kitchen", id: x.id })}>
            <span className="ui-row-label"><span>{x.name}</span><span className="ui-row-sub mono">{[...x.pin_codes, ...staffOf(x.id).map(firstName), ...(invitesOf(x.id).length ? [`${invitesOf(x.id).length} invited`] : [])].join(" · ") || "No pin code yet"}</span></span>
            <span className={`ui-tag ${stateOf(x)[1]}`}>{stateOf(x)[0]}</span>
          </button>
        ))}
        <div className="ui-pad-y"><button type="button" className="ui-btn ghost" onClick={() => { onError(null); onView({ kind: "add" }); }}>+ Add a kitchen</button></div>
      </section>
      <section className="ui-group" aria-label="Riders">
        <h2>Riders {riders && <span className="mono">{online} online · {riderRows.length - online} off</span>}</h2>
        {!riders && <div className="ui-row ui-row-static"><span className="ui-row-label"><span>Could not read the riders.</span><span className="ui-row-sub mono">Online or offline is unknown</span></span><button type="button" className="ui-btn ghost small" onClick={() => void reload()}>Try again</button></div>}
        {riderRows.map((r) => (
          <div key={r.key} className="ui-row ui-row-static">
            <span className="ui-row-label"><span>{r.name}</span><span className="ui-row-sub mono">{r.sub}</span></span>
            <span className="ui-row-acts">{r.person && removeButton(r.person)}{riders && <span className={`ui-tag ${r.online ? "ready" : "placed"}`}>{r.online ? "Online" : "Offline"}</span>}</span>
          </div>
        ))}
        {invites.filter((i) => i.kind === "rider").map(inviteRow)}
        {people.filter((p) => p.kind === "admin").map((p) => <div key={p.user_id} className="ui-row ui-row-static"><span className="ui-row-label"><span>{firstName(p)}</span><span className="ui-row-sub mono">Admin · {p.email ?? p.user_id}</span></span>{removeButton(p)}</div>)}
        {!addingPerson && <div className="ui-pad-y"><button type="button" className="ui-btn ghost" onClick={() => { onError(null); setAddingPerson(true); }}>+ Add a person</button></div>}
        {addingPerson && (
          <div className="ui-form ui-form-flush">
            <div className="ui-field"><label htmlFor="p-email">Email</label><input id="p-email" type="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} /></div>
            <div className="ui-field"><label htmlFor="p-role">Role</label><select id="p-role" value={who.kind} onChange={(e) => setWho({ ...who, kind: e.target.value as PersonKind })}><option value="kitchen">Kitchen staff</option><option value="rider">Rider</option><option value="admin">Admin</option></select></div>
            {who.kind === "kitchen" && <div className="ui-field"><label htmlFor="p-kitchen">Kitchen</label><select id="p-kitchen" value={who.kitchen} onChange={(e) => setWho({ ...who, kitchen: e.target.value })}><option value="">Pick a kitchen</option>{kitchens.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>}
            <div className="ui-form-acts"><button type="button" className="ui-btn big" onClick={() => void submitPerson()}>Add person</button><button type="button" className="ui-btn ghost big" onClick={() => { setAddingPerson(false); setInvited(null); setAddError(null); }}>Not now</button></div>
            {addError && <p role="alert" className="ui-note error">{addError}</p>}
            {invited && (   // board A-AddPerson-Invite
              <div role="status" className="ui-invite">
                <p className="ui-invite-title">Invite ready for {invited.email}</p>
                <p className="ui-meta">They open the {invited.kind} link and tap Continue with Google once. Nothing to install. {invited.kind === "kitchen" ? "Their kitchen" : "Their deliveries"} open on that first sign-in.</p>
                <div className="ui-invite-link"><span className="mono">{inviteLink(invited.kind, window.location.origin).replace(/^https?:\/\//, "")}</span><button type="button" className="ui-btn ghost small" onClick={() => void share()}>Share the link</button></div>
                {shareNote && <p className="ui-meta" role="status">{shareNote}</p>}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// Story 900, board A8; story #955: the shared danger sheet (board D1-RemoveKitchen). Ask 1 of 2 is this sheet (type REMOVE); ask 2 is the database, which refuses while orders are open and says so here.
function RemoveSheet({ kitchen, onClose, onRemoved }: { kitchen: KitchenRow; onClose: () => void; onRemoved: () => Promise<void> }) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    const line = await removeKitchen(getClient(), kitchen.id);
    setBusy(false);
    if (line) return setError(line);
    onClose();
    await onRemoved();   // the city list is read again; the kitchen shows as Off
  };
  return (
    <DangerSheet id="remove-word" title={`Remove ${kitchen.name}?`} kicker="Ask 1 of 2 · asks twice · admin only"
      sentence="The kitchen leaves GoServe today. Customers stop seeing it at once. Nothing is deleted."
      facts={[["Stops", "New orders, the menu, and every staff sign-in to this kitchen."], ["Finishes", "Orders already placed, and today's slips and cash."], ["Stays", "Past orders, bills and numbers. The kitchen stays in the city list, marked Off."]]}
      word="REMOVE" value={word} onValue={setWord} confirmLabel="Remove this kitchen" leaveLabel="Keep it open" after="Open orders? It refuses until they are done."
      busy={busy} error={error} onConfirm={() => void go()} onClose={onClose} />
  );
}
