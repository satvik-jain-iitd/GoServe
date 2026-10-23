// The day's numbers (story A4): one total line and one line per kitchen. Shown in the Numbers tab and at the top of the Ops app.
import { useEffect, useState } from "react";
import { dayNumbers, sumNumbers, type DayNumbers } from "../lib/admin";
import { formatRupees } from "../lib/money";
import { getClient } from "../lib/supabase";

export function AdminNumbers() {
  const [rows, setRows] = useState<DayNumbers[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { dayNumbers(getClient()).then(setRows, () => setError(true)); }, []);
  if (error) return <p role="alert" className="error">Could not load the numbers. Try again.</p>;
  if (!rows) return <p>Loading…</p>;
  const t = sumNumbers(rows);
  return (
    <>
      <p data-testid="day-total"><strong>Today: {t.orders} orders</strong> · {t.delivered} delivered · {t.cancelled} cancelled · cash {formatRupees(t.cash_paise)}</p>
      <ul className="tickets">
        {rows.map((r) => (
          <li key={r.kitchen_id} className="ticket">
            <strong>{r.kitchen_name}</strong>
            <p className="note">{r.orders} orders · {r.delivered} delivered · {r.cancelled} cancelled · cash {formatRupees(Number(r.cash_paise))}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
