import type { PlacedOrder } from "../lib/orders";
import { formatRupees } from "../lib/money";
import { shortId } from "../lib/kitchen";

export function PlacedScreen({ order, onAgain }: { order: PlacedOrder; onAgain: () => void }) {
  return (
    <section>
      <h2>Order placed</h2>
      <p>Your order number is <strong>{shortId(order.id)}</strong>.</p>
      <p>Total to pay on delivery: {formatRupees(order.total_paise)}</p>
      <p className="note">Status: {order.status}. We will show it moving here soon.</p>
      <button type="button" className="btn" onClick={onAgain}>Order more</button>
    </section>
  );
}
