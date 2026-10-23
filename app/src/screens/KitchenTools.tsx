// The kitchen's own controls (story A6): open or close the kitchen, and mark a dish sold out. Shown only to a user listed as this kitchen's staff.
import { useCallback, useEffect, useState } from "react";
import { listDishes, setDish, type DishRow } from "../lib/admin";
import { formatRupees } from "../lib/money";
import { myKitchen } from "../lib/session";
import { ensureSession, getClient } from "../lib/supabase";

export function KitchenTools() {
  const [kitchen, setKitchen] = useState<{ id: string; open: boolean } | null>(null);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      await ensureSession();
      const c = getClient();
      const id = await myKitchen(c);
      if (!id) return setKitchen(null);
      const { data } = await c.from("kitchens").select("open").eq("id", id).limit(1);
      setKitchen({ id, open: (data?.[0] as { open?: boolean } | undefined)?.open !== false });
      setDishes(await listDishes(c, id));
    } catch {
      setError("Could not load your kitchen controls. Check your connection.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!kitchen) return error ? <p role="alert" className="error">{error}</p> : null;

  const flip = async () => {
    setError(null);
    const { error: failed } = await getClient().rpc("set_kitchen_open", { p_kitchen: kitchen.id, p_open: !kitchen.open });
    if (failed) setError("Could not change the kitchen. Try again.");
    else setKitchen({ ...kitchen, open: !kitchen.open });
  };
  const stock = async (d: DishRow) => {
    setError(null);
    const failed = await setDish(getClient(), d.id, { available: d.available === false });
    if (failed) setError(failed);
    else setDishes(await listDishes(getClient(), kitchen.id));
  };
  return (
    <section>
      <h2>Your kitchen</h2>
      <p role="status" className="notice">{kitchen.open ? "Kitchen is open" : "Kitchen is closed"}{" "}
        <button type="button" className="btn small" onClick={() => void flip()}>{kitchen.open ? "Close kitchen" : "Open kitchen"}</button>
      </p>
      {error && <p role="alert" className="error">{error}</p>}
      <ul className="tickets">
        {dishes.map((d) => (
          <li key={d.id} className="ticket">
            <strong>{d.name}</strong> {d.available === false ? <span className="badge">Sold out</span> : null}
            <p className="note">{formatRupees(d.price_paise)}</p>
            <button type="button" className="btn ghost small" aria-label={d.available === false ? `Put ${d.name} back in stock` : `Mark ${d.name} sold out`} onClick={() => void stock(d)}>
              {d.available === false ? "Back in stock" : "Sold out"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
