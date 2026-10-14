import type { Dish } from "../lib/menu";
import { formatRupees } from "../lib/money";

type Props = { dishes: Dish[]; fromCache: boolean; cartCount: number; onAdd: (id: string) => void; onOpenCart: () => void };

export function MenuScreen({ dishes, fromCache, cartCount, onAdd, onOpenCart }: Props) {
  return (
    <>
      {fromCache && <p className="notice">Showing the saved menu (offline).</p>}
      <ul className="dishes">
        {dishes.map((d) => (
          <li key={d.id} className="dish">
            {d.image_url && <img src={d.image_url} alt={d.name} loading="lazy" />}
            <div className="dish-body">
              <span className="dish-name">{d.name}</span>
              <span className="price">{formatRupees(d.price_paise)}</span>
              {d.image_credit && <small className="credit">Photo: {d.image_credit}</small>}
            </div>
            <button type="button" className="btn small" aria-label={`Add ${d.name}`} onClick={() => onAdd(d.id)}>Add</button>
          </li>
        ))}
      </ul>
      {cartCount > 0 && (
        <button type="button" className="btn bar" onClick={onOpenCart}>View cart ({cartCount})</button>
      )}
    </>
  );
}
