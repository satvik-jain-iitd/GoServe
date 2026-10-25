// Story H7 (#190): the admin Simulator tab. Parameters, Seed, Reset, the tick switch, Tick now, and the counts. Every tap is one webhook call (lib/sim.ts).
import { useEffect, useState } from "react";
import { callSim, countsLine, SEED_DEFAULTS, simDeps, SimError, tickLine, type SimAnswer } from "../lib/sim";
import { Skeleton } from "../ui";

type Form = typeof SEED_DEFAULTS;
const FIELDS: { key: keyof Form; label: string; min: number; max: number }[] = [
  { key: "kitchens", label: "Kitchens", min: 1, max: 50 }, { key: "riders", label: "Riders", min: 1, max: 200 }, { key: "dishes_per_kitchen", label: "Dishes per kitchen", min: 1, max: 12 },
  { key: "seed", label: "Seed number", min: 0, max: 2147483647 }, { key: "open_pct", label: "Kitchens open %", min: 0, max: 100 }, { key: "online_pct", label: "Riders online %", min: 0, max: 100 },
];

export function AdminSim() {
  const [state, setState] = useState<SimAnswer | null>(null);
  const [form, setForm] = useState<Form>(SEED_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (go: () => Promise<SimAnswer>, say: (a: SimAnswer) => string, apply: (a: SimAnswer) => void) => {
    setBusy(true); setError(null); setNote(null);
    try { const a = await go(); apply(a); setNote(say(a)); }
    catch (e) { setError(e instanceof SimError ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };
  useEffect(() => { callSim("status", {}, simDeps()).then(setState, (e) => setError(e instanceof SimError ? e.message : "Could not reach the simulator.")); }, []);

  const counts = (a: SimAnswer) => setState((s) => ({ ...(s ?? { ok: true }), ...a }));
  const seed = () => run(() => callSim("seed", form, simDeps()), (a) => `Seeded: ${a.kitchens} kitchens, ${a.riders} riders, ${a.dishes} dishes.`, counts);
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
        <p className="ui-meta">The same seed number gives the same kitchens, names and places again.</p>
      </section>
      <button type="button" className="ui-btn ghost big" disabled={busy} onClick={reset}>Reset the city</button>
    </div>
  );
}
