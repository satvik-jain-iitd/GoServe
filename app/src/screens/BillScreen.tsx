import type { Line } from "../lib/cart";
import { formatRupees } from "../lib/money";
import { AppBar, Button } from "../ui";

type Props = { lines: Line[]; total: number; address: string; sending: boolean; error: string | null; onBack: () => void; onPlace: () => void };

export function BillScreen({ lines, total, address, sending, error, onBack, onPlace }: Props) {
  return (
    <section>
      <AppBar title="Your bill" onBack={onBack} />
      <ul className="lines">
        {lines.map(({ dish, qty, line_paise }) => (
          <li key={dish.id} className="line">
            <span className="dish-name">{dish.name} × {qty}</span>
            <span className="price">{formatRupees(line_paise)}</span>
          </li>
        ))}
      </ul>
      <p className="total">Total <strong data-testid="bill-total">{formatRupees(total)}</strong></p>
      <p className="note">Delivery is free. You pay when the food arrives.</p>
      <p className="note">Delivering to: {address}</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <Button variant="ghost" disabled={sending} onClick={onBack}>Back to cart</Button>
        <Button disabled={sending} onClick={onPlace}>Place order (cash on delivery)</Button>
      </div>
    </section>
  );
}
