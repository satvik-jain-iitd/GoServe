import { useState } from "react";
import { categoriesOf, filterDishes } from "../lib/browse";
import type { Dish } from "../lib/menu";
import { formatRupees } from "../lib/money";
import { Button, Chip, Empty, StickyBar, Tile } from "../ui";

type Props = { dishes: Dish[]; fromCache: boolean; cartCount: number; cartTotal: number; onAdd: (id: string) => void; onOpenCart: () => void };

export function MenuScreen({ dishes, fromCache, cartCount, cartTotal, onAdd, onOpenCart }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [query, setQuery] = useState("");
  const categories = categoriesOf(dishes);
  const shown = filterDishes(dishes, { category, vegOnly, query });
  return (
    <>
      {fromCache && <p className="notice">Showing the saved menu (offline).</p>}
      <input className="ui-search" type="search" aria-label="Search dishes" placeholder="Search dishes" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="ui-chips" role="group" aria-label="Filters">
        {categories.length > 0 && <Chip selected={category === null} onClick={() => setCategory(null)}>All</Chip>}
        {categories.map((c) => <Chip key={c} selected={category === c} onClick={() => setCategory(category === c ? null : c)}>{c}</Chip>)}
        <Chip selected={vegOnly} onClick={() => setVegOnly(!vegOnly)}>Veg only</Chip>
      </div>
      {shown.length === 0 && <Empty title="Nothing matches" hint="Try another word or clear the filters." />}
      <ul className="dishes">
        {shown.map((d) => (
          <li key={d.id}>
            <Tile title={d.name} price={formatRupees(d.price_paise)} image={d.image_url ?? undefined} veg={d.veg} meta={d.image_credit ? `Photo: ${d.image_credit}` : undefined}>
              <Button aria-label={`Add ${d.name}`} onClick={() => onAdd(d.id)}>Add</Button>
            </Tile>
          </li>
        ))}
      </ul>
      {cartCount > 0 && (
        <StickyBar><Button onClick={onOpenCart}>View cart ({cartCount}) · {formatRupees(cartTotal)}</Button></StickyBar>
      )}
    </>
  );
}
