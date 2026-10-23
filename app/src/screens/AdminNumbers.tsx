// The day's numbers (story A4): one total line and one line per kitchen. Shown in the Numbers tab and at the top of the Ops app.
import { useEffect, useState } from "react";
import { dayNumbers, sumNumbers, type DayNumbers } from "../lib/admin";
import { formatRupees } from "../lib/money";
import { Skeleton } from "../ui";
import { getClient } from "../lib/supabase";

export function AdminNumbers() {
  const [rows, setRows] = useState<DayNumbers[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { dayNumbers(getClient()).then(setRows, () => setError(true)); }, []);
  if (error) return <p role="alert" className="error">Could not load the numbers. Try again.</p>;
  if (!rows) return <Skeleton lines={3} />;
  const t = sumNumbers(rows);
  return (
    <>
      <p data-testid="day-total"><strong>Today: {t.orders} orders</strong> · {t.delivered} delivered · {t.cancelled} cancelled · cash {formatRupees(t.cash_paise)}</p>
      <table className="ui-table">
        <thead><tr><th scope="col">Kitchen</th><th scope="col">Orders</th><th scope="col">Delivered</th><th scope="col">Cancelled</th><th scope="col">Cash</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kitchen_id}><td>{r.kitchen_name}</td><td>{r.orders}</td><td>{r.delivered}</td><td>{r.cancelled}</td><td>{formatRupees(Number(r.cash_paise))}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
