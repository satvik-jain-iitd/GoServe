import { riderActions, shortId, statusLabel, type Order, type RiderAction } from "../lib/kitchen";
import { formatRupees } from "../lib/money";
import { Button, Empty, Skeleton } from "../ui";

type Props = { orders: Order[]; loading: boolean; error: string | null; busyId: string | null; arrived: Set<string>; onAct: (order: Order, action: RiderAction) => void };

export function RiderScreen({ orders, loading, error, busyId, arrived, onAct }: Props) {
  return (
    <section>
      <h2>Rider</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {loading && <Skeleton lines={3} />}
      {!loading && orders.length === 0 && !error && <Empty title="No deliveries yet." hint="A delivery shows here when a kitchen has it ready." />}
      <ul className="tickets">
        {orders.map((o) => (
          <li key={o.id} className="ticket">
            <div className="ticket-head">
              <strong>Order {shortId(o.id)}</strong>
              <span className={`badge ${o.status}`}>{statusLabel(o.status)}</span>
            </div>
            <p className="note">{o.address}</p>
            <p className="note">Collect {formatRupees(o.total_paise)} (pay on delivery)</p>
            {o.customer_phone && <a className="ui-btn ghost" href={`tel:${o.customer_phone}`}>Call {o.customer_name || "customer"}</a>}
            {riderActions(o.status).map((a) => (
              <Button key={a.label} size="big" aria-label={`${a.label} ${shortId(o.id)}`}
                disabled={busyId === o.id || (a.kind === "event" && arrived.has(o.id))} onClick={() => onAct(o, a)}>
                {a.label}
              </Button>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
