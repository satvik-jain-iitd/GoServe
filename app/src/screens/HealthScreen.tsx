// /health (story #54): the founder opens it before a demo and sees OK or FAIL for Supabase, n8n and Jev.
import { useCallback, useEffect, useState } from "react";
import { checkOrderApi, checkSupabase, type Check } from "../lib/health";
import { orderDeps } from "../lib/orders";
import { formatMs } from "../lib/ops";

export function HealthScreen() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const run = useCallback(async () => {
    setChecks(null);
    const [sb, [n8n, jev]] = await Promise.all([
      checkSupabase(fetch.bind(window), import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY),
      checkOrderApi(orderDeps()),
    ]);
    setChecks([sb, n8n, jev]);
  }, []);
  useEffect(() => void run(), [run]);

  return (
    <main className="shell">
      <h1>GoServe</h1>
      <h2>Health</h2>
      {!checks && <p role="status">Checking…</p>}
      {checks && (
        <>
          <p role="status"><strong>{checks.every((c) => c.ok) ? "All green" : "Something failed"}</strong></p>
          <ul className="tickets">
            {checks.map((c) => (
              <li key={c.name} className="ticket" data-testid={`check-${c.name}`}>
                <div className="ticket-head">
                  <strong>{c.name}</strong>
                  <span className={c.ok ? "badge ready" : "badge fail"}>{c.ok ? "OK" : "FAIL"}</span>
                </div>
                <p className="note">{c.ms === null ? "No time" : formatMs(c.ms)}{c.note && ` · ${c.note}`}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="btn" disabled={!checks} onClick={run}>Run again</button>
    </main>
  );
}
