// The menu of the Ink v3 boards 02, 02a, 02b, 02c and 03 (story H10b, #193): header, greeting, thali hero, sections, filter sheet, dish sheet.
import { useState } from "react";
import { filterDishes } from "../lib/browse";
import { greeting, sectionsOf, thalisOf } from "../lib/home";
import { creditLicence, creditLine, type Dish } from "../lib/menu";
import { formatRupees } from "../lib/money";
import { Empty, Stepper, TabBar, VegMark } from "../ui";

type Props = {
  dishes: Dish[] | null; fromCache: boolean; error: string | null;
  pin: string | null; kitchenName: string; openText: string; name: string; closedText: string | null;
  qty: Record<string, number>; cartCount: number; cartTotal: number;
  onAdd: (id: string) => void; onChange: (id: string, delta: number) => void; onOpenCart: () => void;
  onChangePin: () => void; onOrders: () => void; onYou: () => void;
};

const FunnelIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>;
const VegIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="1" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>;

export function MenuScreen(p: Props) {
  const [vegOnly, setVegOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dish, setDish] = useState<Dish | null>(null);
  const all = p.dishes ?? [];
  const shown = filterDishes(all, { vegOnly, query });
  const thali = thalisOf(shown);
  const sections = sectionsOf(shown);
  const closed = p.closedText !== null;
  const add = (d: Dish) => <button type="button" className="ui-btn" aria-label={`Add ${d.name}`} disabled={closed} onClick={() => p.onAdd(d.id)}>Add</button>;
  const control = (d: Dish) => ((p.qty[d.id] ?? 0) > 0 ? <Stepper label={d.name} value={p.qty[d.id]} onChange={(n) => p.onChange(d.id, n - p.qty[d.id])} /> : add(d));
  return (
    <>
      <header className="ui-head">
        <button type="button" className="ui-pin" aria-label={`Change area, pin code ${p.pin ?? ""}`} onClick={p.onChangePin}>
          <img className="ui-logo ui-pin-mark ui-mark-land" src="/brand/pin-mark-day.png" alt="" />{p.pin}
        </button>
        <button type="button" className="ui-btn ghost icon" aria-label="Veg only" aria-pressed={vegOnly} onClick={() => setVegOnly(!vegOnly)}><VegIcon /></button>
        <button type="button" className="ui-btn ghost icon" aria-label="Filter" onClick={() => setFilterOpen(true)}><FunnelIcon /></button>
      </header>
      <div className="ui-scroll" aria-busy={p.dishes === null && !p.error ? true : undefined} aria-label={p.dishes === null && !p.error ? "Loading the menu" : undefined}>
        <div className="ui-greet">
          <h1>{greeting(new Date().getHours(), p.name)}</h1>
          {p.kitchenName ? <h2 className="ui-greet-line">{p.kitchenName}{p.openText ? ` · ${p.openText}` : ""}</h2> : null}
          <div className="ui-zigzag" aria-hidden="true" />
        </div>
        {closed && (
          <div className="ui-closed">
            <span className="ui-stamp placed small">Closed</span>
            <p className="ui-closed-main">{p.closedText}</p>
          </div>
        )}
        {p.fromCache && <p className="notice">Showing the saved menu (offline).</p>}
        {p.error && <p role="alert" className="error ui-pad">{p.error}</p>}
        {p.dishes === null && !p.error && <Loading />}
        {p.dishes !== null && (thali.veg || thali.nonveg) && <Hero veg={thali.veg} nonveg={thali.nonveg} closed={closed} qty={p.qty} onAdd={p.onAdd} />}
        {p.dishes !== null && shown.length === 0 && <div className="ui-pad"><Empty title="Nothing matches" hint="Try another word or clear the filters." /></div>}
        {sections.map((s) => (
          <div key={s.id} className={closed ? "ui-dim" : undefined}>
            <div className="ui-section"><h2 id={s.id}>{s.title}</h2></div>
            <div className="ui-list">
              {s.dishes.map((d) => (
                <article key={d.id} className="ui-tile">
                  <button type="button" className="ui-photo-btn" aria-label={`${d.name} details`} onClick={() => setDish(d)}>
                    {d.image_url ? <img className="ui-photo" src={d.image_url} alt="" loading="lazy" /> : <span className="ui-photo" aria-hidden="true" />}
                  </button>
                  <div className="ui-tile-body">
                    <h3>{d.veg !== undefined && <VegMark veg={d.veg} />}{d.name}</h3>
                    <p className="ui-price">{formatRupees(d.price_paise)}</p>
                  </div>
                  {control(d)}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
      {p.cartCount > 0 && !closed && (
        <div className="ui-sticky float">
          <button type="button" className="ui-btn bar" aria-label={`View bill (${p.cartCount}) · ${formatRupees(p.cartTotal)}`} onClick={p.onOpenCart}>
            <span className="mono">{p.cartCount} {p.cartCount === 1 ? "item" : "items"} · {formatRupees(p.cartTotal)}</span><span className="verb">View bill ›</span>
          </button>
        </div>
      )}
      <TabBar current="menu" onMenu={() => undefined} onOrders={p.onOrders} onYou={p.onYou} />
      {filterOpen && (
        <FilterSheet count={shown.length} vegOnly={vegOnly} onVeg={setVegOnly} query={query} onQuery={setQuery}
          sections={sectionsOf(all)} onClose={() => setFilterOpen(false)}
          onJump={(id) => { setFilterOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 0); }} />
      )}
      {dish && <DishSheet dish={dish} closed={closed} qty={p.qty[dish.id] ?? 0} onAdd={(n) => { for (let i = 0; i < n; i++) p.onAdd(dish.id); setDish(null); }} onClose={() => setDish(null)} />}
    </>
  );
}

function Loading() {
  return (
    <div aria-hidden="true">
      <div className="ui-hero"><div className="photo" /><div className="body"><div className="ui-skel"><span style={{ width: "55%" }} /><span style={{ width: "80%" }} /><span style={{ width: "20%" }} /></div></div></div>
      <div className="ui-section"><h2>Mains</h2></div>
      <div className="ui-list">
        {[60, 70, 55].map((w) => (
          <div key={w} className="ui-tile-skel"><span className="ui-photo" /><div className="ui-skel"><span style={{ width: `${w}%` }} /><span style={{ width: "85%" }} /><span style={{ width: "24%" }} /></div></div>
        ))}
      </div>
    </div>
  );
}

function Hero({ veg, nonveg, closed, qty, onAdd }: { veg?: Dish; nonveg?: Dish; closed: boolean; qty: Record<string, number>; onAdd: (id: string) => void }) {
  const page = (d: Dish, id: string) => (
    <div className="page" id={id} key={id}>
      <div className="photo">{d.image_url && <img src={d.image_url} alt={d.name} />}<span className="ui-tag">Today</span></div>
      <div className="body">
        <div><h3>{d.veg !== undefined && <VegMark veg={d.veg} />}{d.name}</h3><p className="price-pair"><span className="ui-price">{formatRupees(d.price_paise)}</span></p></div>
        <button type="button" className="ui-btn" aria-label={`Add ${d.name}`} disabled={closed} onClick={() => onAdd(d.id)}>{(qty[d.id] ?? 0) > 0 ? `Added ${qty[d.id]}` : "Add"}</button>
      </div>
    </div>
  );
  return (
    <section className="ui-hero" aria-label="Today's thali">
      {veg && nonveg && (
        <nav className="ui-seg" aria-label="Veg or non-veg thali">
          <a href="#thali-veg" className="on" aria-label="Veg thali"><VegMark veg /></a>
          <a href="#thali-nonveg" className="nonveg" aria-label="Non-veg thali"><VegMark veg={false} /></a>
        </nav>
      )}
      <div className="pager">{veg && page(veg, "thali-veg")}{nonveg && page(nonveg, "thali-nonveg")}</div>
    </section>
  );
}

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="ui-sheet-back" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={label} className="ui-sheet ui-sheet-flush" onClick={(e) => e.stopPropagation()}>{children}</section>
    </div>
  );
}

function FilterSheet({ count, vegOnly, onVeg, query, onQuery, sections, onClose, onJump }: { count: number; vegOnly: boolean; onVeg: (v: boolean) => void; query: string; onQuery: (q: string) => void; sections: { id: string; title: string; dishes: Dish[] }[]; onClose: () => void; onJump: (id: string) => void }) {
  return (
    <Modal label="Filter" onClose={onClose}>
      <div className="ui-sheet-head"><h2>Filter</h2><span className="mono ui-count">{count} {count === 1 ? "dish" : "dishes"}</span></div>
      <input className="ui-search" type="search" aria-label="Search dishes" placeholder="Search dishes" value={query} onChange={(e) => onQuery(e.target.value)} />
      <div className="ui-switch-row">
        <label htmlFor="veg" className="ui-switch-label">Veg only</label>
        <input id="veg" className="ui-switch" type="checkbox" role="switch" checked={vegOnly} onChange={(e) => onVeg(e.target.checked)} />
      </div>
      <nav aria-label="Sections" className="ui-sections">
        {sections.map((s) => <button key={s.id} type="button" className="ui-row" onClick={() => onJump(s.id)}><span>{s.title}</span><span className="mono ui-count">{s.dishes.length}</span></button>)}
      </nav>
      <button type="button" className="ui-btn ghost big" onClick={onClose}>Close</button>
    </Modal>
  );
}

function DishSheet({ dish, closed, qty, onAdd, onClose }: { dish: Dish; closed: boolean; qty: number; onAdd: (n: number) => void; onClose: () => void }) {
  const [n, setN] = useState(Math.max(1, qty ? 1 : 1));
  return (
    <Modal label={dish.name} onClose={onClose}>
      {dish.image_url ? <img className="ui-dish-photo" src={dish.image_url} alt="" /> : <div className="ui-dish-photo" aria-hidden="true" />}
      <div className="ui-dish-body">
        <div className="ui-dish-head"><h2>{dish.veg !== undefined && <VegMark veg={dish.veg} size={14} />}{dish.name}</h2><span className="ui-dish-price">{formatRupees(dish.price_paise)}</span></div>
        <p className="ui-kicker">{dish.veg === undefined ? "" : dish.veg ? "Veg" : "Non-veg"}{dish.category ? ` · ${dish.category}` : ""}</p>
        {dish.image_credit && <CreditLine credit={dish.image_credit} />}
        <div className="ui-dish-count"><span className="ui-kicker">How many</span><Stepper label={dish.name} value={n} min={1} onChange={setN} /></div>
      </div>
      <div className="ui-dish-act">
        <button type="button" className="ui-btn big" disabled={closed} onClick={() => onAdd(n)}>Add to bill · {formatRupees(dish.price_paise * n)}</button>
        <button type="button" className="ui-btn ghost big" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function CreditLine({ credit }: { credit: string }) {
  const lic = creditLicence(credit);
  if (!lic) return <p className="ui-meta">{creditLine(credit)}</p>;
  return <p className="ui-meta">Photo: {lic.before}<a href={lic.href} target="_blank" rel="noopener noreferrer">{lic.label}</a></p>;
}
