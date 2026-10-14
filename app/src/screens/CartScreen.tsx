import { MAX_QTY, type Line } from "../lib/cart";
import { formatRupees } from "../lib/money";

type Props = {
  lines: Line[]; address: string; onAddress: (v: string) => void;
  onChange: (id: string, delta: number) => void; onBack: () => void; onReview: () => void;
};

export function CartScreen({ lines, address, onAddress, onChange, onBack, onReview }: Props) {
  const ready = lines.length > 0 && address.trim().length > 0;
  return (
    <section>
      <h2>Your cart</h2>
      {lines.length === 0 && <p>Your cart is empty.</p>}
      <ul className="lines">
        {lines.map(({ dish, qty, line_paise }) => (
          <li key={dish.id} className="line">
            <span className="dish-name">{dish.name}</span>
            <span className="qty">
              <button type="button" className="btn small" aria-label={`Less ${dish.name}`} onClick={() => onChange(dish.id, -1)}>−</button>
              <span aria-label={`Quantity of ${dish.name}`}>{qty}</span>
              <button type="button" className="btn small" aria-label={`More ${dish.name}`} disabled={qty >= MAX_QTY} onClick={() => onChange(dish.id, +1)}>+</button>
            </span>
            <span className="price">{formatRupees(line_paise)}</span>
          </li>
        ))}
      </ul>
      <label className="field">
        Delivery address
        <textarea value={address} maxLength={300} rows={3} onChange={(e) => onAddress(e.target.value)} />
      </label>
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onBack}>Back to menu</button>
        <button type="button" className="btn" disabled={!ready} onClick={onReview}>Review bill</button>
      </div>
    </section>
  );
}
