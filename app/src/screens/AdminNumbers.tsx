// The day's numbers on the Ink v3 board A8 (story H12, #195; story A4): tiles, then one row per kitchen. Shown on the admin Numbers tab and at the top of the Ops app.
import { useEffect, useState } from "react";
import { dayNumbers, sumNumbers, type DayNumbers, type KitchenRow } from "../lib/admin";
import { formatRupees } from "../lib/money";
import { Skeleton } from "../ui";
import { getClient } from "../lib/supabase";

export function AdminNumbers({ live, kitchens }: { live?: number; kitchens?: KitchenRow[] }) {
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
      <button type="button" className="ui-row" onClick={() => window.dispatchEvent(new Event("gs-feedback"))}><span>Send feedback</span><span className="go" aria-hidden="true">›</span></button>
    </div>
  );
}
