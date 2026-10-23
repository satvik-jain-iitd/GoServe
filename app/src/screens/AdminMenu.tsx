// The Menu tab of the admin app (story A3): dishes of one kitchen, with a photo from the phone.
import { useCallback, useEffect, useState } from "react";
import { addDish, deleteDish, listDishes, photoProblem, rupeesToPaise, setDish, type DishRow, type KitchenRow } from "../lib/admin";
import { dishProblem } from "../lib/validate";
import { formatRupees } from "../lib/money";
import { getClient } from "../lib/supabase";
import { Button } from "../ui";

export function AdminMenu({ kitchens, onError }: { kitchens: KitchenRow[]; onError: (m: string | null) => void }) {
  const [kitchen, setKitchen] = useState("");
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [form, setForm] = useState({ name: "", price: "", category: "", veg: true });
  const [photo, setPhoto] = useState<File | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [fileKey, setFileKey] = useState(0);   // a new key empties the file field after a save

  const load = useCallback(async () => {
    if (!kitchen) return setDishes([]);
    try {
      setDishes(await listDishes(getClient(), kitchen));
    } catch {
      onError("Could not load the dishes. Try again.");
    }
  }, [kitchen, onError]);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const paise = rupeesToPaise(form.price);
    if (!kitchen) return onError("Pick a kitchen first.");
    const rule = dishProblem(form);
    if (rule || paise === null) return onError(rule ?? "Type the price in rupees, for example 220 or 220.50.");
    const problem = photo ? photoProblem(photo) : null;
    if (problem) return onError(problem);
    const failed = await addDish(getClient(), { kitchenId: kitchen, name: form.name.trim(), paise, veg: form.veg, category: form.category.trim(), photo });
    onError(failed);
    if (!failed) { setForm({ name: "", price: "", category: "", veg: true }); setPhoto(null); setFileKey((k) => k + 1); await load(); }
  };
  const change = async (id: string, c: { available?: boolean; price_paise?: number }) => {
    const failed = await setDish(getClient(), id, c);
    onError(failed);
    if (!failed) await load();
  };
  const remove = async (id: string) => {
    const failed = await deleteDish(getClient(), id);
    onError(failed);
    if (!failed) await load();
  };

  return (
    <>
      <label>Kitchen
        <select aria-label="Kitchen" value={kitchen} onChange={(e) => setKitchen(e.target.value)}>
          <option value="">Pick a kitchen</option>
          {kitchens.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </label>
      <ul className="tickets">
        {dishes.map((d) => (
          <li key={d.id} className="ticket">
            <strong>{d.name}</strong> {d.available === false ? <span className="badge">Sold out</span> : null}
            <p className="note">{formatRupees(d.price_paise)} · {d.veg ? "Veg" : "Non-veg"}{d.category ? ` · ${d.category}` : ""}</p>
            {d.image_url && <img src={d.image_url} alt="" width={64} height={64} />}
            <div className="dish-actions">
              <Button variant="ghost" aria-label={d.available === false ? `Make ${d.name} available` : `Mark ${d.name} sold out`}
                onClick={() => void change(d.id, { available: d.available === false })}>{d.available === false ? "Make available" : "Sold out"}</Button>
              <label>New price for {d.name}<input aria-label={`New price for ${d.name}`} inputMode="decimal" value={prices[d.id] ?? ""} onChange={(e) => setPrices({ ...prices, [d.id]: e.target.value })} /></label>
              <Button variant="ghost" aria-label={`Save price of ${d.name}`} onClick={() => {
                const paise = rupeesToPaise(prices[d.id] ?? "");
                if (paise === null) return onError("Type the price in rupees, for example 220 or 220.50.");
                void change(d.id, { price_paise: paise });
              }}>Save price</Button>
              <Button variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => void remove(d.id)}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
      <h3>Add a dish</h3>
      <label>Dish name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Price (₹)<input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
      <label>Category<input value={form.category} placeholder="main, starter, dessert" onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
      <label><input type="checkbox" checked={form.veg} onChange={(e) => setForm({ ...form, veg: e.target.checked })} /> Veg</label>
      <label>Photo<input key={fileKey} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
      <Button onClick={() => void submit()}>Add dish</Button>
    </>
  );
}
