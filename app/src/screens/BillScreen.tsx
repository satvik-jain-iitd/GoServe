// The one bill screen of the Ink v3 boards 04 and 04e (story H10c, #193): the slip, who and where, and Place order. It replaces the cart and the old bill.
import type { Line } from "../lib/cart";
import { formatRupees } from "../lib/money";
import { isPhone } from "../lib/profile";

type Props = {
  lines: Line[]; total: number; kitchenName: string; pin: string | null;
  address: string; onAddress: (v: string) => void;
  details?: { name: string; phone: string; onName: (v: string) => void; onPhone: (v: string) => void; gate?: boolean };   // the customer app also asks who and which phone (story B3)
  sending: boolean; error: string | null;
  onBack: () => void; onPlace: () => void;
};

const plain = (paise: number) => formatRupees(paise).replace("₹", "");
export const BackChevron = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" className="ui-back" aria-label={label} onClick={onClick}>
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square"><path d="M15 6l-6 6 6 6" /></svg>
  </button>
);

export function BillScreen({ lines, total, kitchenName, pin, address, onAddress, details, sending, error, onBack, onPlace }: Props) {
  const empty = lines.length === 0;
  const ready = !empty && address.trim().length > 0 && (!details || details.gate || (details.name.trim().length > 0 && isPhone(details.phone)));   // story #551: with the phone code on, the sheets ask the number and the name
  const head = [kitchenName, pin].filter(Boolean).join(" · ");
  return (
    <>
      <header className="ui-head">
        <BackChevron label="Back to menu" onClick={onBack} />
        <h1>Your bill</h1>
      </header>
      <div className="ui-scroll">
        <section className="ui-slip ui-slip-pad" aria-label={empty ? "Empty bill" : "Items"}>
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>{head}</span></div>
            {empty ? (
              <div className="ui-empty ui-empty-slip">
                <h2>Nothing on it yet</h2>
                <p className="ui-meta">Add a dish from the menu.</p>
                <button type="button" className="ui-btn" onClick={onBack}>See the menu</button>
              </div>
            ) : (
              <div className="ui-slip-lines">
                {lines.map(({ dish, qty, line_paise }) => <div key={dish.id}><span>{qty} × {dish.name}</span><span>{plain(line_paise)}</span></div>)}
                <div><span>Delivery</span><span>Free</span></div>
              </div>
            )}
            <div className="ui-slip-rule" />
            <div className={empty ? "ui-slip-total ui-muted" : "ui-slip-total"}><b>Cash at door</b><span data-testid="bill-total">{formatRupees(total)}</span></div>
            {!empty && <button type="button" className="ui-btn ghost ui-add-more" onClick={onBack}>+ Add more</button>}
          </div>
        </section>
        {!empty && (
          <form className="ui-form" onSubmit={(e) => e.preventDefault()}>
            {details && !details.gate && (
              <>
                <div className="ui-field"><label htmlFor="name">Your name</label><input id="name" type="text" value={details.name} maxLength={80} autoComplete="name" onChange={(e) => details.onName(e.target.value)} /></div>
                <div className="ui-field"><label htmlFor="phone">Phone · the rider calls this</label><input id="phone" className="mono-input" type="tel" value={details.phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" onChange={(e) => details.onPhone(e.target.value.replace(/\D/g, ""))} /></div>
              </>
            )}
            <div className="ui-field"><label htmlFor="address">Address{pin ? ` · pin ${pin}` : ""}</label><textarea id="address" rows={2} value={address} maxLength={300} onChange={(e) => onAddress(e.target.value)} /></div>
            <p className="ui-note">Pay the rider cash at the door.</p>
            {error && <p role="alert" className="ui-field-error">{error}</p>}
          </form>
        )}
      </div>
      {!empty && (
        <div className="ui-sticky float">
          <button type="button" className="ui-btn bar" disabled={!ready || sending} onClick={onPlace}>
            <span className="mono">Cash · {formatRupees(total)}</span><span className="verb">Place order ›</span>
          </button>
        </div>
      )}
    </>
  );
}
