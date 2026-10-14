import { formatMs, median, suggestionText, type DecisionRow } from "../lib/ops";
import { shortId, type Order } from "../lib/kitchen";

type Props = {
  orders: Order[];
  decisions: DecisionRow[];
  lags: number[];
  stats: { runsToday: number; lastDecideMs: number | null };
  error: string | null;
  failed: Record<string, string>;
  sample?: boolean;   // offline demo: the numbers are samples
};

export function OpsScreen({ orders, decisions, lags, stats, error, failed, sample }: Props) {
  const latest = new Map<string, DecisionRow>();
  for (const d of decisions) if (d.order_id && !latest.has(d.order_id)) latest.set(d.order_id, d);   // newest first
  const rows = orders.filter((o) => o.status === "ready" || latest.has(o.id));
  const lag = median(lags);
  return (
    <section>
      <h2>Ops</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {rows.length === 0 && !error && <p>No ready orders yet.</p>}
      <ul className="tickets">
        {rows.map((o) => (
          <li key={o.id} className="ticket">
            <strong>Order {shortId(o.id)}</strong>
            <p>{latest.has(o.id) ? suggestionText(latest.get(o.id)!.decision) : failed[o.id] ? `No suggestion: ${failed[o.id]}` : "Asking for a suggestion…"}</p>
          </li>
        ))}
      </ul>
      <h3>Numbers</h3>
      {sample && <p className="note">Sample numbers (offline demo).</p>}
      <dl className="metrics">
        <dt>Order to this screen</dt>
        <dd data-testid="metric-lag">{lag === null ? "No live order seen yet." : formatMs(lag)}</dd>
        <dt>Decision time</dt>
        <dd data-testid="metric-decision">{stats.lastDecideMs === null ? "No decision yet." : formatMs(stats.lastDecideMs)}</dd>
        <dt>Runs today (this demo)</dt>
        <dd data-testid="metric-runs">{stats.runsToday}</dd>
      </dl>
    </section>
  );
}
