import { MAX_QTY, type Line } from "../lib/cart";
import { formatRupees } from "../lib/money";
import { isPhone } from "../lib/profile";

type Props = {
  lines: Line[]; address: string; onAddress: (v: string) => void;
  details?: { name: string; phone: string; onName: (v: string) => void; onPhone: (v: string) => void };   // the customer app also asks who and which phone (story B3)
  onChange: (id: string, delta: number) => void; onBack: () => void; onReview: () => void;
};

export function CartScreen({ lines, address, onAddress, details, onChange, onBack, onReview }: Props) {
  const ready = lines.length > 0 && address.trim().length > 0 && (!details || (details.name.trim().length > 0 && isPhone(details.phone)));
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
      {details && (
        <>
          <label className="field">Your name<input value={details.name} maxLength={80} autoComplete="name" onChange={(e) => details.onName(e.target.value)} /></label>
          <label className="field">Phone number<input value={details.phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" onChange={(e) => details.onPhone(e.target.value.replace(/\D/g, ""))} /></label>
        </>
      )}
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
