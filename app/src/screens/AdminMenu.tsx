// The menu of one kitchen on board A6 (story H12, #195; story A3): the dishes with sold out, a new price and delete, and the Add a dish form with a photo from the phone.
import { useCallback, useEffect, useState } from "react";
import { addDish, deleteDish, listDishes, photoProblem, rupeesToPaise, setDish, uploadDishPhoto, type DishChange, type DishRow } from "../lib/admin";
import { dishProblem } from "../lib/validate";
import { formatRupees } from "../lib/money";
import { getClient } from "../lib/supabase";
import { DangerSheet, DishPlate, VegMark, useSheetFit } from "../ui";

export function AdminMenu({ kitchenId, kitchenName, onError }: { kitchenId: string; kitchenName?: string; onError: (m: string | null) => void }) {
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", category: "", description: "", veg: true });
  const [photo, setPhoto] = useState<File | null>(null);
  const [editing, setEditing] = useState<DishRow | null>(null);   // story #936: the Edit sheet
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
    const failed = await addDish(getClient(), { kitchenId, name: form.name.trim(), paise, veg: form.veg, category: form.category.trim(), description: form.description.trim(), photo });
    onError(failed);
    if (!failed) { setForm({ name: "", price: "", category: "", description: "", veg: true }); setPhoto(null); setFileKey((k) => k + 1); setAdding(false); await load(); }
  };
  return (
    <section className="ui-group" aria-label="Menu">
      <h2>Menu <span className="mono">{dishes.length} {dishes.length === 1 ? "dish" : "dishes"}</span></h2>
      {dishes.map((d) => (
        <button key={d.id} type="button" className="ui-row ui-dish-line" aria-label={`Edit ${d.name}${d.available === false ? " Sold out" : ""} ${formatRupees(d.price_paise)}`}   /* the name holds all the visible text (WCAG 2.5.3) */ onClick={() => { onError(null); setEditing(d); }}>
          <span className={`ui-dish-main${d.available === false ? " off" : ""}`}>
            {d.image_url ? <img className="ui-dish-thumb" src={d.image_url} alt="" width={40} height={40} /> : <span className="ui-dish-thumb ui-ph" aria-hidden="true"><DishPlate size={26} /></span>}
            <VegMark veg={d.veg !== false} />
            <span className="ui-dish-text"><span>{d.name}</span>{d.available === false && <span className="ui-tag error">Sold out</span>}</span>
          </span>
          <span className={`mono ui-krow-price${d.available === false ? " off" : ""}`}>{formatRupees(d.price_paise)}</span>
          <span className="ui-go" aria-hidden="true">›</span>
        </button>
      ))}
      {!adding && <div className="ui-pad-y"><button type="button" className="ui-btn ghost" onClick={() => { onError(null); setAdding(true); }}>+ Add a dish</button></div>}
      {adding && (
        <div className="ui-form ui-form-flush">
          <div className="ui-field"><label htmlFor="dish-name">Dish name</label><input id="dish-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="ui-field"><label htmlFor="dish-price">Price (₹)</label><input id="dish-price" className="mono-input" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div className="ui-field"><label htmlFor="dish-cat">Category</label><input id="dish-cat" type="text" value={form.category} placeholder="Thali, Mains, Breads" onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="ui-field"><label htmlFor="dish-line">Short line (optional)</label><input id="dish-line" type="text" value={form.description} placeholder="Slow cooked overnight, butter on top" onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="ui-row ui-row-static"><label htmlFor="dish-veg" className="ui-row-label"><span>Veg</span></label><input id="dish-veg" className="ui-switch" type="checkbox" role="switch" checked={form.veg} onChange={(e) => setForm({ ...form, veg: e.target.checked })} /></div>
          <div className="ui-field"><label htmlFor="dish-photo">Photo</label><input id="dish-photo" key={fileKey} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
          <div className="ui-form-acts"><button type="button" className="ui-btn big" onClick={() => void submit()}>Add dish</button><button type="button" className="ui-btn ghost big" onClick={() => setAdding(false)}>Not now</button></div>
        </div>
      )}
      {editing && <DishSheet dish={editing} kitchenId={kitchenId} kitchenName={kitchenName} onError={onError} onClose={() => setEditing(null)} onDone={async () => { setEditing(null); await load(); }} />}
    </section>
  );
}

// Story #936, board M2-DishEdit: one sheet with every field of a dish. Save sends only what changed. Delete asks once more with the danger sheet of #955.
function DishSheet({ dish, kitchenId, kitchenName, onError, onClose, onDone }: { dish: DishRow; kitchenId: string; kitchenName?: string; onError: (m: string | null) => void; onClose: () => void; onDone: () => Promise<void> }) {
  const fit = useSheetFit();   // story #954: the overlay follows the visual viewport
  const [name, setName] = useState(dish.name);
  const [price, setPrice] = useState(String(dish.price_paise / 100));
  const [category, setCategory] = useState(dish.category ?? "");
  const [veg, setVeg] = useState(dish.veg !== false);
  const [inStock, setInStock] = useState(dish.available !== false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [word, setWord] = useState("");
  const preview = photo ? URL.createObjectURL(photo) : dish.image_url;

  const save = async () => {
    const paise = rupeesToPaise(price);
    const rule = dishProblem({ name, price, category });
    if (rule || paise === null) return setError(rule ?? "Type the price in rupees, for example 220 or 220.50.");
    const problem = photo ? photoProblem(photo) : null;
    if (problem) return setError(problem);
    const change: DishChange = {};
    if (name.trim() !== dish.name) change.name = name.trim();
    if (paise !== dish.price_paise) change.price_paise = paise;
    if (category.trim() !== (dish.category ?? "")) change.category = category.trim() || null;
    if (veg !== (dish.veg !== false)) change.veg = veg;
    if (inStock !== (dish.available !== false)) change.available = inStock;
    setBusy(true);
    setError(null);
    if (photo) {
      const url = await uploadDishPhoto(getClient(), kitchenId, photo);
      if (!url) { setBusy(false); return setError("The photo could not be uploaded. Try again."); }
      change.image_url = url;
    }
    const failed = Object.keys(change).length === 0 ? null : await setDish(getClient(), dish.id, change);
    setBusy(false);
    if (failed) return setError(failed);
    await onDone();
  };
  const remove = async () => {
    setBusy(true);
    const failed = await deleteDish(getClient(), dish.id);
    setBusy(false);
    if (failed) { setDeleting(false); return setError(failed); }
    onError(null);
    await onDone();
  };

  if (deleting) {
    return (
      <DangerSheet id="delete-word" title={`Delete ${dish.name}?`} kicker="Asks once · the dish, not the orders" sentence="The dish leaves the menu now. Past orders keep its name and price."
        facts={[["Goes", "The dish, its photo and its place on the menu."], ["Stays", "Past orders and bills that name it."]]}
        word="DELETE" value={word} onValue={setWord} confirmLabel="Delete this dish" leaveLabel="Keep the dish" after="Sold out keeps a dish; delete does not."
        busy={busy} onConfirm={() => void remove()} onClose={() => { setDeleting(false); setWord(""); }} />
    );
  }
  return (
    <div ref={fit} className="ui-sheet-back" onClick={onClose}>
      <section className="ui-sheet ui-danger ui-dish-sheet" role="dialog" aria-modal="true" aria-label={`Edit ${dish.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="ui-danger-head">
          <div><h2>{dish.name}</h2><span className="mono ui-danger-kicker">{kitchenName ? `Edit dish · ${kitchenName}` : "Edit dish"}</span></div>
          <button type="button" className="ui-btn ghost icon" aria-label="Close" onClick={onClose}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="ui-dish-photo-row">
          {preview ? <img src={preview} alt="" width={64} height={64} /> : <span className="ui-ph ui-dish-photo-ph" aria-hidden="true" />}
          <label className="ui-btn ghost ui-file-btn">Change photo<input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
        </div>
        <label className="ui-danger-label" htmlFor="d-name">Dish name</label>
        <input id="d-name" className="ui-sheet-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="ui-two">
          <div><label className="ui-danger-label" htmlFor="d-price">Price (₹)</label><input id="d-price" className="ui-sheet-input mono-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><label className="ui-danger-label" htmlFor="d-cat">Category</label><input id="d-cat" className="ui-sheet-input" type="text" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
        </div>
        <div className="ui-row ui-row-static ui-sheet-switch"><span>Veg</span><input className="ui-switch" type="checkbox" role="switch" aria-label="Veg" checked={veg} onChange={(e) => setVeg(e.target.checked)} /></div>
        <div className="ui-row ui-row-static ui-sheet-switch"><span className="ui-stock"><span>In stock</span></span><input className="ui-switch" type="checkbox" role="switch" aria-label="In stock" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /></div>
        {error && <p role="alert" className="ui-note error">{error}</p>}
        <div className="ui-danger-acts"><button type="button" className="ui-btn big" disabled={busy} onClick={() => void save()}>Save</button></div>
        <button type="button" className="ui-row ui-delete-row" onClick={() => setDeleting(true)}>
          <span><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>Delete this dish</span><span aria-hidden="true">›</span>
        </button>
      </section>
    </div>
  );
}
