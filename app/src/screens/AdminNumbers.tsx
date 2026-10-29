// The day's numbers on the Ink v3 board A8 (story H12, #195; story A4): tiles, then one row per kitchen. Shown on the admin Numbers tab and at the top of the Ops app.
import { useEffect, useState } from "react";
import { dayNumbers, sumNumbers, type DayNumbers, type KitchenRow } from "../lib/admin";
import { formatRupees } from "../lib/money";
import { Skeleton } from "../ui";
import { getClient } from "../lib/supabase";
import { readSwapSetting, saveSwapSetting, swapPctProblem, type SwapSetting } from "../lib/swapSetting";

// Board A9: the admin-only Settings row for the sold-out swap discount.
function SwapSettings() {
  const [now, setNow] = useState<SwapSetting | null>(null);
  const [text, setText] = useState("");
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => { readSwapSetting(getClient()).then((s) => { setNow(s); setText((typed) => (typed === "" ? String(s.pct) : typed)); }, () => setLine("Could not load the setting. Try again.")); }, []);
  async function save() {
    const problem = swapPctProblem(text);
    if (problem) return void setLine(problem);
    const failed = await saveSwapSetting(getClient(), Number(text));
    setLine(failed);
    if (!failed) setNow({ pct: Number(text), updated_by: "you", updated_at: new Date().toISOString() });
  }
  return (
    <section className="ui-group" aria-label="Settings">
      <h2>Settings</h2>
      <div className="ui-row ui-row-static">
        <span className="ui-row-label"><b>Sold-out swap discount</b><span className="ui-row-sub mono">% off the new item, paid by us · 0 to 50</span></span>
        <span className="ui-inline">
          <input type="number" min={0} max={50} step={1} value={text} aria-label="Sold-out swap discount, percent" className="mono ui-pct" onChange={(e) => { setText(e.target.value); setLine(null); }} />
          <span className="mono">%</span>
          <button type="button" className="ui-btn" onClick={() => void save()}>Save</button>
        </span>
      </div>
      {now && <p className="mono ui-foot">Now {now.pct}% · set by {now.updated_by ?? "the system"}, {new Date(now.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</p>}
      {line && <p role="alert" className="ui-note error">{line}</p>}
    </section>
  );
}

export function AdminNumbers({ live, kitchens, settings }: { live?: number; kitchens?: KitchenRow[]; settings?: boolean }) {
  const [rows, setRows] = useState<DayNumbers[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { dayNumbers(getClient()).then(setRows, () => setError(true)); }, []);
  if (error) return <p role="alert" className="ui-note error">Could not load the numbers. Try again.</p>;
  if (!rows) return <div className="ui-pad"><Skeleton lines={3} /></div>;
  const t = sumNumbers(rows);
  const open = kitchens ? kitchens.filter((k) => k.open && k.active).length : null;
  return (
    <div className="ui-pad">
      <p data-testid="day-total" className="mono ui-foot ui-day-total">Today: {t.orders} orders · {t.delivered} delivered · {t.cancelled} cancelled · cash {formatRupees(t.cash_paise)}</p>
      <div className="ui-stats">
        <div className="ui-stat" data-testid="tile-orders"><span className="ui-stat-k">Orders</span><span className="ui-stat-v mono">{t.orders}</span>{live !== undefined && <span className="ui-stat-s mono">{live} live</span>}</div>
        <div className="ui-stat" data-testid="tile-delivered"><span className="ui-stat-k">Delivered</span><span className="ui-stat-v mono">{t.delivered}</span><span className="ui-stat-s mono">{t.cancelled} cancelled</span></div>
        <div className="ui-stat" data-testid="tile-cash"><span className="ui-stat-k">Cash today</span><span className="ui-stat-v mono">{formatRupees(t.cash_paise)}</span></div>
        {open !== null && <div className="ui-stat" data-testid="tile-kitchens"><span className="ui-stat-k">Kitchens open</span><span className="ui-stat-v mono">{open} of {kitchens!.length}</span></div>}
      </div>
      <section className="ui-group" aria-label="Per kitchen">
        <h2>Per kitchen</h2>
        {rows.map((r) => (
          <div key={r.kitchen_id} className="ui-row ui-row-static">
            <span className="ui-row-label"><span>{r.kitchen_name}</span><span className="ui-row-sub mono">{r.orders} orders · {r.delivered} delivered · {r.cancelled} cancelled</span></span>
            <span className="mono">{formatRupees(Number(r.cash_paise))}</span>
          </div>
        ))}
      </section>
      {settings && <SwapSettings />}
      <button type="button" className="ui-row" onClick={() => window.dispatchEvent(new Event("gs-feedback"))}><span>Send feedback</span><span className="go" aria-hidden="true">›</span></button>
    </div>
  );
}
