// Story H7 (#190): the admin Simulator tab. Parameters, Seed, Reset, the tick switch, Tick now, and the counts. Every tap is one webhook call (lib/sim.ts).
import { useEffect, useState } from "react";
import { callSim, countsLine, KNOB_DEFAULTS, SEED_DEFAULTS, simDeps, SimError, tickLine, type Knobs, type SimAnswer } from "../lib/sim";
import { Skeleton } from "../ui";

type Form = typeof SEED_DEFAULTS;
const FIELDS: { key: keyof Form; label: string; min: number; max: number }[] = [
  { key: "riders_per_kitchen", label: "Riders per kitchen", min: 1, max: 20 }, { key: "online_pct", label: "Riders online %", min: 0, max: 100 },
];
// #284: how the programmed kitchens and riders misbehave. Percent of orders (or of tick rolls) that go wrong.
const KNOBS: { key: keyof Knobs; label: string }[] = [
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

  const run = async (go: () => Promise<SimAnswer>, say: (a: SimAnswer) => string, apply: (a: SimAnswer) => void) => {
    setBusy(true); setError(null); setNote(null);
    try { const a = await go(); apply(a); setNote(say(a)); }
    catch (e) { setError(e instanceof SimError ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };
  useEffect(() => { callSim("status", {}, simDeps()).then((a) => { setState(a); if (a.knobs) setKnobs(a.knobs); }, (e) => setError(e instanceof SimError ? e.message : "Could not reach the simulator.")); }, []);

  const counts = (a: SimAnswer) => setState((s) => ({ ...(s ?? { ok: true }), ...a }));
  const seed = () => run(() => callSim("seed", form, simDeps()), (a) => `Seeded: ${a.kitchens} kitchens, ${a.riders} riders, ${a.dishes} dishes.`, counts);
  const saveKnobs = () => run(() => callSim("knobs", knobs, simDeps()), () => "Scenario saved.", (a) => { if (a.knobs) setKnobs(a.knobs); });
  const reset = () => {
    if (!window.confirm("Remove every synthetic kitchen, rider and dish? Real ones stay.")) return;
    void run(() => callSim("reset", {}, simDeps()), (a) => `Removed: ${a.kitchens} kitchens, ${a.riders} riders, ${a.dishes} dishes.`, () => counts({ ok: true, kitchens: 0, kitchens_open: 0, riders: 0, riders_online: 0, dishes: 0 }));
  };
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
      <button type="button" className="ui-btn ghost big" disabled={busy} onClick={() => void tick()}>Tick now</button>
      <section className="ui-group" aria-label="Seed parameters">
        <h2>Seed</h2>
        {FIELDS.map((f) => (
          <div key={f.key} className="ui-field"><label htmlFor={`sim-${f.key}`}>{f.label}</label>
            <input id={`sim-${f.key}`} className="mono-input" type="number" inputMode="numeric" min={f.min} max={f.max} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: Math.min(f.max, Math.max(f.min, Number(e.target.value) || 0)) })} /></div>
        ))}
        <button type="button" className="ui-btn big" disabled={busy} onClick={() => void seed()}>Seed the city</button>
        <p className="ui-meta">Loads the ten Delhi kitchens with their menus, and the riders. If the city still has the old random kitchens, reset it first.</p>
      </section>
      <section className="ui-group" aria-label="Scenario">
        <h2>Scenario</h2>
        {KNOBS.map((f) => (
          <div key={f.key} className="ui-field"><label htmlFor={`sim-${f.key}`}>{f.label}</label>
            <input id={`sim-${f.key}`} className="mono-input" type="number" inputMode="numeric" min={0} max={100} value={knobs[f.key]} onChange={(e) => setKnobs({ ...knobs, [f.key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></div>
        ))}
        <button type="button" className="ui-btn big" disabled={busy} onClick={() => void saveKnobs()}>Save the scenario</button>
        <p className="ui-meta">Orders are placed by people, never by the simulator. These numbers say how often a programmed kitchen turns one away or runs slow, and how often a rider drops out.</p>
      </section>
      <button type="button" className="ui-btn ghost big" disabled={busy} onClick={reset}>Reset the city</button>
    </div>
  );
}
