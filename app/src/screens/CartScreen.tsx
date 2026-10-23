import { MAX_QTY, type Line } from "../lib/cart";
import { formatRupees } from "../lib/money";
import { isPhone } from "../lib/profile";
import { AppBar, Button, Empty, Stepper } from "../ui";

type Props = {
  lines: Line[]; address: string; onAddress: (v: string) => void;
  details?: { name: string; phone: string; onName: (v: string) => void; onPhone: (v: string) => void };   // the customer app also asks who and which phone (story B3)
  onChange: (id: string, delta: number) => void; onBack: () => void; onReview: () => void;
};

export function CartScreen({ lines, address, onAddress, details, onChange, onBack, onReview }: Props) {
  const ready = lines.length > 0 && address.trim().length > 0 && (!details || (details.name.trim().length > 0 && isPhone(details.phone)));
  return (
    <section>
      <AppBar title="Your cart" onBack={onBack} />
      {lines.length === 0 && <Empty title="Your cart is empty" hint="Add a dish from the menu." />}
      <ul className="lines">
        {lines.map(({ dish, qty, line_paise }) => (
          <li key={dish.id} className="line">
            <span className="dish-name">{dish.name}</span>
            <Stepper label={dish.name} value={qty} min={0} max={MAX_QTY} onChange={(n) => onChange(dish.id, n - qty)} />
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
        <Button variant="ghost" onClick={onBack}>Back to menu</Button>
        <Button disabled={!ready} onClick={onReview}>Review bill</Button>
      </div>
    </section>
  );
}
