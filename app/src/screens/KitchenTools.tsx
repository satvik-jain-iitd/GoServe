// The kitchen's dishes on the Kitchen tab of board K5 (story H11, #194; story A6): sold out per dish, grouped by category.
import { useCallback, useEffect, useState } from "react";
import { listDishes, setDish, type DishRow } from "../lib/admin";
import { getClient } from "../lib/supabase";
import { VegMark } from "../ui";

export function DishList({ kitchenId }: { kitchenId: string }) {
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setDishes(await listDishes(getClient(), kitchenId)); } catch { setError("Could not load the dishes. Check your connection."); }
  }, [kitchenId]);
  useEffect(() => { void load(); }, [load]);
  const stock = async (d: DishRow) => {
    setError(null);
    const failed = await setDish(getClient(), d.id, { available: d.available === false });
    if (failed) setError(failed);
    else await load();
  };
  const groups = dishes.reduce<Record<string, DishRow[]>>((g, d) => { const k = d.category || "Dishes"; (g[k] ??= []).push(d); return g; }, {});
  return (
    <>
      {error && <p role="alert" className="ui-note error">{error}</p>}
      {Object.entries(groups).map(([cat, rows]) => (
        <section key={cat} className="ui-group" aria-label={cat}>
          <h2>{cat}</h2>
          {rows.map((d) => (
            <div key={d.id} className="ui-row ui-row-static">
              <span className="ui-dish-name"><VegMark veg={d.veg !== false} />{d.name}{d.available === false && <span className="ui-tag error">Sold out</span>}</span>
              <button type="button" className="ui-btn ghost small" aria-label={d.available === false ? `Put ${d.name} back in stock` : `Mark ${d.name} sold out`} onClick={() => void stock(d)}>
                {d.available === false ? "Back in stock" : "Sold out"}
              </button>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
