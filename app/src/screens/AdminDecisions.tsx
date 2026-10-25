// Story #263: the admin's Decisions block. Exactly one engine is on: Rules (the default, cost zero), Jev, or Laya (greyed until it is deployed).
// A change is one call to n8n with the admin's own sign-in; the answer carries the new version and who changed it.
import { useEffect, useState } from "react";
import { callEngine, engineDeps, EngineError, ENGINES, type EngineAnswer, type EngineKey } from "../lib/engine";
import { Skeleton } from "../ui";

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function AdminDecisions() {
  const [state, setState] = useState<EngineAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = (e: unknown) => setError(e instanceof EngineError ? e.message : "Something went wrong. Please try again.");
  useEffect(() => { callEngine("get", undefined, engineDeps()).then(setState, fail); }, []);

  const pick = async (key: EngineKey) => {
    if (busy || key === state?.engine) return;
    setBusy(true); setError(null);
    try { setState(await callEngine("set", key, engineDeps())); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <section className="ui-group" aria-label="Decisions">
      <h2>Decisions</h2>
      <p className="ui-meta">Who picks the rider for each ready order. One is on at a time.</p>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {!state && !error && <Skeleton lines={3} />}
      {state && ENGINES.map((e) => (
        <div key={e.key} className="ui-row ui-row-static">
          <label htmlFor={`engine-${e.key}`} className="ui-row-label"><span>{e.label}</span><span className="ui-row-sub">{e.hint}</span></label>
          <input id={`engine-${e.key}`} type="radio" name="engine" checked={state.engine === e.key} disabled={!e.ready || busy} onChange={() => void pick(e.key)} />
        </div>
      ))}
      {state && <p data-testid="engine-meta" className="ui-meta mono">Version {state.version} · {state.by ?? "system"}{state.changed_at ? ` · ${when(state.changed_at)}` : ""}</p>}
    </section>
  );
}
