import { nextStep, shortId, statusLabel, type Order } from "../lib/kitchen";
import { formatRupees } from "../lib/money";

type Props = { orders: Order[]; loading: boolean; error: string | null; busyId: string | null; onStep: (order: Order, to: string) => void };

export function KitchenScreen({ orders, loading, error, busyId, onStep }: Props) {
  return (
    <section>
      <h2>Kitchen</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {loading && <p>Loading orders…</p>}
      {!loading && orders.length === 0 && !error && <p>No orders yet.</p>}
      <ul className="tickets">
        {orders.map((o) => {
          const step = nextStep(o.status);
          return (
            <li key={o.id} className="ticket">
              <div className="ticket-head">
                <strong>Order {shortId(o.id)}</strong>
                <span className={`badge ${o.status}`}>{statusLabel(o.status)}</span>
              </div>
              <ul className="ticket-lines">
                {o.items.map((l) => <li key={l.menu_item_id}>{l.name} × {l.qty}</li>)}
              </ul>
              <p className="note">{o.address}</p>
              <p className="note">Total {formatRupees(o.total_paise)} (pay on delivery)</p>
              {step && (
                <button type="button" className="btn" aria-label={`${step.label} ${shortId(o.id)}`} disabled={busyId === o.id} onClick={() => onStep(o, step.to)}>
                  {step.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
