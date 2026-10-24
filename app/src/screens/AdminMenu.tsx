// The menu of one kitchen on board A6 (story H12, #195; story A3): the dishes with sold out, a new price and delete, and the Add a dish form with a photo from the phone.
import { useCallback, useEffect, useState } from "react";
import { addDish, deleteDish, listDishes, photoProblem, rupeesToPaise, setDish, type DishRow } from "../lib/admin";
import { dishProblem } from "../lib/validate";
import { formatRupees } from "../lib/money";
import { getClient } from "../lib/supabase";
import { VegMark } from "../ui";

export function AdminMenu({ kitchenId, onError }: { kitchenId: string; onError: (m: string | null) => void }) {
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", category: "", veg: true });
  const [photo, setPhoto] = useState<File | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [fileKey, setFileKey] = useState(0);   // a new key empties the file field after a save

  const load = useCallback(async () => {
    try { setDishes(await listDishes(getClient(), kitchenId)); } catch { onError("Could not load the dishes. Try again."); }
  }, [kitchenId, onError]);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const paise = rupeesToPaise(form.price);
    const rule = dishProblem(form);
    if (rule || paise === null) return onError(rule ?? "Type the price in rupees, for example 220 or 220.50.");
    const problem = photo ? photoProblem(photo) : null;
    if (problem) return onError(problem);
    const failed = await addDish(getClient(), { kitchenId, name: form.name.trim(), paise, veg: form.veg, category: form.category.trim(), photo });
    onError(failed);
    if (!failed) { setForm({ name: "", price: "", category: "", veg: true }); setPhoto(null); setFileKey((k) => k + 1); setAdding(false); await load(); }
  };
  const change = async (id: string, c: { available?: boolean; price_paise?: number }) => {
    const failed = await setDish(getClient(), id, c);
    onError(failed);
    if (!failed) await load();
  };
  const remove = async (d: DishRow) => {
    if (!window.confirm(`Delete ${d.name} from the menu? Sold out keeps it; delete does not.`)) return;
    const failed = await deleteDish(getClient(), d.id);
    onError(failed);
    if (!failed) await load();
  };

  return (
    <section className="ui-group" aria-label="Menu">
      <h2>Menu <span className="mono">{dishes.length} {dishes.length === 1 ? "dish" : "dishes"}</span></h2>
      {dishes.map((d) => (
        <div key={d.id} className="ui-dish-row">
          <div className="ui-row ui-row-static ui-row-tall">
            <span className="ui-dish-name">{d.image_url && <img className="ui-dish-thumb" src={d.image_url} alt="" width={40} height={40} />}<VegMark veg={d.veg !== false} />{d.name}{d.available === false && <span className="ui-tag error">Sold out</span>}</span>
            <span className="mono">{formatRupees(d.price_paise)}</span>
          </div>
          <div className="ui-dish-acts">
            <button type="button" className="ui-btn ghost small" aria-label={d.available === false ? `Back in stock ${d.name}` : `Mark ${d.name} sold out`} onClick={() => void change(d.id, { available: d.available === false })}>{d.available === false ? "Back in stock" : "Sold out"}</button>
            <input className="ui-dish-price" aria-label={`New price for ${d.name}`} inputMode="decimal" placeholder="₹" value={prices[d.id] ?? ""} onChange={(e) => setPrices({ ...prices, [d.id]: e.target.value })} />
            <button type="button" className="ui-btn ghost small" aria-label={`Save price of ${d.name}`} onClick={() => {
              const paise = rupeesToPaise(prices[d.id] ?? "");
              if (paise === null) return onError("Type the price in rupees, for example 220 or 220.50.");
              void change(d.id, { price_paise: paise });
            }}>Save price</button>
            <button type="button" className="ui-btn ghost small danger" aria-label={`Delete ${d.name}`} onClick={() => void remove(d)}>Delete</button>
          </div>
        </div>
      ))}
      {!adding && <div className="ui-pad-y"><button type="button" className="ui-btn ghost" onClick={() => { onError(null); setAdding(true); }}>+ Add a dish</button></div>}
      {adding && (
        <div className="ui-form ui-form-flush">
          <div className="ui-field"><label htmlFor="dish-name">Dish name</label><input id="dish-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="ui-field"><label htmlFor="dish-price">Price (₹)</label><input id="dish-price" className="mono-input" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div className="ui-field"><label htmlFor="dish-cat">Category</label><input id="dish-cat" type="text" value={form.category} placeholder="Thali, Mains, Breads" onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="ui-row ui-row-static"><label htmlFor="dish-veg" className="ui-row-label"><span>Veg</span></label><input id="dish-veg" className="ui-switch" type="checkbox" role="switch" checked={form.veg} onChange={(e) => setForm({ ...form, veg: e.target.checked })} /></div>
          <div className="ui-field"><label htmlFor="dish-photo">Photo</label><input id="dish-photo" key={fileKey} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
          <div className="ui-form-acts"><button type="button" className="ui-btn big" onClick={() => void submit()}>Add dish</button><button type="button" className="ui-btn ghost big" onClick={() => setAdding(false)}>Not now</button></div>
        </div>
      )}
    </section>
  );
}
