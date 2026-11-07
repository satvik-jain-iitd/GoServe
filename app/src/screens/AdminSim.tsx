// Story H7 (#190): the admin Simulator tab. Parameters, Seed, Reset, the tick switch, Tick now, and the counts.
// Story #848 (boards A-Sim-Groups, A-Sim-Clear): two groups, Kitchens and Riders, each with its own seed button; Clear everything sits under Start over, dev only. Every tap is one webhook call (lib/sim.ts).
import { useEffect, useState } from "react";
import { callSim, clearAll, clearShown, CLEAR_WORD, readClearAllowed, countsLine, groupLine, KNOB_DEFAULTS, SEED_DEFAULTS, simDeps, SimError, tickLine, type Knobs, type SimAnswer } from "../lib/sim";
import { getClient } from "../lib/supabase";
import { DangerSheet, Skeleton } from "../ui";

type Form = typeof SEED_DEFAULTS;
const FIELDS: { key: keyof Form; label: string; min: number; max: number }[] = [
  { key: "riders_per_kitchen", label: "Riders per kitchen", min: 1, max: 20 }, { key: "online_pct", label: "Riders online %", min: 0, max: 100 },
];
// #284: how the programmed kitchens and riders misbehave. Percent of orders (or of tick rolls) that go wrong.
const KNOBS: { key: Exclude<keyof Knobs, "demo">; label: string }[] = [
  { key: "reject_pct", label: "Kitchen turns the order away %" }, { key: "sold_out_pct", label: "Item sold out %" },
  { key: "delay_pct", label: "Kitchen is slow %" }, { key: "rider_drop_pct", label: "Rider drops out %" },
];

export function AdminSim() {
  const [state, setState] = useState<SimAnswer | null>(null);
  const [form, setForm] = useState<Form>(SEED_DEFAULTS);
  const [knobs, setKnobs] = useState<Knobs>(KNOB_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);   // story #941: asked of the database directly; null until it answers
  const [word, setWord] = useState("");

  const run = async (go: () => Promise<SimAnswer>, say: (a: SimAnswer) => string, apply: (a: SimAnswer) => void) => {
    setBusy(true); setError(null); setNote(null);
    try { const a = await go(); apply(a); setNote(say(a)); }
    catch (e) { setError(e instanceof SimError ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };
  useEffect(() => { callSim("status", {}, simDeps()).then((a) => { setState(a); if (a.knobs) setKnobs(a.knobs); }, (e) => setError(e instanceof SimError ? e.message : "Could not reach the simulator.")); }, []);

  useEffect(() => { if (import.meta.env.VITE_SIM_CLEAR === "1") void readClearAllowed(getClient()).then(setAllowed); }, []);

  const counts = (a: SimAnswer) => setState((s) => ({ ...(s ?? { ok: true }), ...a }));
  const seedKitchens = () => run(() => callSim("seed_kitchens", {}, simDeps()), (a) => `Seeded: ${a.kitchens} kitchens, ${a.dishes} dishes.`, counts);
  const seedRiders = () => run(() => callSim("seed_riders", form, simDeps()), (a) => `Seeded: ${a.riders} riders.`, counts);
  const saveKnobs = () => run(() => callSim("knobs", knobs, simDeps()), () => "Scenario saved.", (a) => { if (a.knobs) setKnobs(a.knobs); });
  const reset = () => {
    if (!window.confirm("Remove every synthetic kitchen, rider and dish? Real ones stay.")) return;
    void run(() => callSim("reset", {}, simDeps()), (a) => `Removed: ${a.kitchens} kitchens, ${a.riders} riders, ${a.dishes} dishes.`, () => counts({ ok: true, kitchens: 0, kitchens_open: 0, riders: 0, riders_online: 0, dishes: 0 }));
  };
  const clear = async () => {
    setClearing(false); setWord("");
    await run(async () => ({ ...(await clearAll(getClient(), (t) => setNote(`Clearing… ${t.orders.toLocaleString("en-IN")} orders gone`))) }), (a) => `Cleared: ${a.kitchens} kitchens, ${a.riders} riders, ${a.dishes} dishes, ${a.orders} orders.`, () => counts({ ok: true, kitchens: 0, kitchens_open: 0, kitchens_real: 0, riders: 0, riders_online: 0, riders_real: 0, dishes: 0 }));
  };
  const knobField = (f: { key: Exclude<keyof Knobs, "demo">; label: string }) => (
    <div key={f.key} className="ui-field"><label htmlFor={`sim-${f.key}`}>{f.label}</label>
      <input id={`sim-${f.key}`} className="mono-input" type="number" inputMode="numeric" min={0} max={100} value={knobs[f.key]} onChange={(e) => setKnobs({ ...knobs, [f.key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></div>
  );
  const demo = (on: boolean) => run(() => callSim("knobs", { demo: on }, simDeps()), (a) => (a.knobs?.demo ? "Demo mode is on. The city stays steady and quick." : "Demo mode is off. Your old numbers are back."), (a) => { if (a.knobs) setKnobs(a.knobs); });
  const toggle = (on: boolean) => run(() => callSim(on ? "enable" : "disable", {}, simDeps()), (a) => (a.enabled ? "The city moves every minute." : "The city stands still."), (a) => counts({ ok: true, enabled: a.enabled }));
  const tick = () => run(() => callSim("tick", {}, simDeps()), tickLine, () => undefined);

  return (
    <div className="ui-pad">
      <p className="ui-meta">Synthetic only. Real kitchens, riders and orders never change.</p>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {note && <p role="status" className="ui-note">{note}</p>}
      {state ? <p data-testid="sim-counts" className="mono ui-foot ui-day-total">{countsLine(state)}</p> : <Skeleton lines={1} />}
      <div className="ui-row ui-row-static">
        <label htmlFor="sim-on" className="ui-row-label"><span>City moves every minute</span><span className="ui-row-sub">Riders walk, a few kitchens and dishes flip</span></label>
        <input id="sim-on" className="ui-switch" type="checkbox" role="switch" checked={state?.enabled === true} disabled={busy || !state} onChange={(e) => void toggle(e.target.checked)} />
      </div>
      <div className="ui-row ui-row-static">
        <label htmlFor="sim-demo" className="ui-row-label"><span>Demo mode</span><span className="ui-row-sub">No flips, no turned-away orders, quick kitchens and riders</span></label>
        <input id="sim-demo" className="ui-switch" type="checkbox" role="switch" checked={knobs.demo === true} disabled={busy || !state} onChange={(e) => void demo(e.target.checked)} />
      </div>
      <div className="ui-pad-y"><button type="button" className="ui-btn ghost" disabled={busy} onClick={() => void tick()}>Tick now</button></div>
      <section className="ui-group" aria-label="Kitchens">
        <h2>Kitchens</h2>
        <p className="ui-meta">{state ? groupLine(state.kitchens, state.kitchens_real) : ""}</p>
        <details className="ui-details">
          <summary><span>Kitchen scenario</span><span className="ui-meta">{`Turns away ${knobs.reject_pct}% · sold out ${knobs.sold_out_pct}% · slow ${knobs.delay_pct}%`}</span></summary>
          <div className="ui-form ui-form-flush">
            {KNOBS.filter((f) => f.key !== "rider_drop_pct").map(knobField)}
            <div className="ui-form-acts"><button type="button" className="ui-btn big" disabled={busy} onClick={() => void saveKnobs()}>Save the kitchen scenario</button></div>
            <p className="ui-meta">Orders are placed by people, never by the simulator. These numbers say how often a programmed kitchen turns one away or runs slow.</p>
          </div>
        </details>
        <div className="ui-form ui-form-flush">
          <div className="ui-form-acts"><button type="button" className="ui-btn big" disabled={busy} onClick={() => void seedKitchens()}>Seed the kitchens</button></div>
          <p className="ui-meta">Ten Delhi kitchens, menus and photos. Riders stay.</p>
        </div>
      </section>
      <section className="ui-group" aria-label="Riders">
        <h2>Riders</h2>
        <p className="ui-meta">{state ? groupLine(state.riders, state.riders_real) : ""}</p>
        <details className="ui-details">
          <summary><span>Rider scenario</span><span className="ui-meta">{`${form.riders_per_kitchen} per kitchen · ${form.online_pct}% online · drops out ${knobs.rider_drop_pct}%`}</span></summary>
          <div className="ui-form ui-form-flush">
            {FIELDS.map((f) => (
              <div key={f.key} className="ui-field"><label htmlFor={`sim-${f.key}`}>{f.label}</label>
                <input id={`sim-${f.key}`} className="mono-input" type="number" inputMode="numeric" min={f.min} max={f.max} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: Math.min(f.max, Math.max(f.min, Number(e.target.value) || 0)) })} /></div>
            ))}
            {KNOBS.filter((f) => f.key === "rider_drop_pct").map(knobField)}
            <div className="ui-form-acts"><button type="button" className="ui-btn big" disabled={busy} onClick={() => void saveKnobs()}>Save the rider scenario</button></div>
            <p className="ui-meta">Riders per kitchen and the online share are used the next time you seed the riders. The drop-out number is saved with the scenario.</p>
          </div>
        </details>
        <div className="ui-form ui-form-flush">
          <div className="ui-form-acts"><button type="button" className="ui-btn big ghost" disabled={busy} onClick={() => void seedRiders()}>Seed the riders</button></div>
          <p className="ui-meta">Investor demos only. Real riders: add in City.</p>
        </div>
      </section>
      <section className="ui-group" aria-label="Start over">
        <h2>Start over</h2>
        <div className="ui-pad-y ui-row-pair">
          <button type="button" className="ui-btn ghost" disabled={busy} onClick={reset}>Reset the city</button>
          {clearShown(import.meta.env.VITE_SIM_CLEAR, allowed) && <button type="button" className="ui-btn ghost danger" disabled={busy || allowed === null} aria-disabled={busy || allowed === null} onClick={() => setClearing(true)}>Clear everything</button>}
        </div>
        <p className="ui-meta">{clearShown(import.meta.env.VITE_SIM_CLEAR, allowed) ? "Everything goes. Logs and accounts stay. Seed brings it back." : "Reset removes the synthetic kitchens, riders and dishes. Real ones stay."}</p>
      </section>
      {clearing && (
        <DangerSheet id="clear-word" title="Clear everything?" kicker="Dev only · cannot be undone" sentence="This empties the dev city. Seed the kitchens brings it back."
          facts={[["Goes", "Every kitchen and dish, every rider, orders, order events, ratings, payments, tracking."], ["Stays", "Run log, decision log, and every account."]]}
          word={CLEAR_WORD} value={word} onValue={setWord} confirmLabel="Clear everything" leaveLabel="Keep the city" after="After it, Seed the kitchens brings the city back."
          busy={busy} onConfirm={() => void clear()} onClose={() => { setClearing(false); setWord(""); }} />
      )}
    </div>
  );
}
