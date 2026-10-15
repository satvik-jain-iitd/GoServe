import type { PlacedOrder } from "../lib/orders";
import { formatRupees } from "../lib/money";
import { shortId, trackerSteps } from "../lib/kitchen";

type Props = { order: PlacedOrder; status: string; onAgain: () => void };

export function PlacedScreen({ order, status, onAgain }: Props) {
  return (
    <section>
      <h2>Order placed</h2>
      <p>Your order number is <strong>{shortId(order.id)}</strong>.</p>
      <p>Total to pay on delivery: {formatRupees(order.total_paise)}</p>
      <ol className="tracker" aria-label="Order progress">
        {trackerSteps(status).map((s) => (
          <li key={s.status} className={`step ${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>{s.label}</li>
        ))}
      </ol>
      {status === "delivered" && <p><strong>Your order has been delivered.</strong></p>}
      <button type="button" className="btn" onClick={onAgain}>Order more</button>
    </section>
  );
}
