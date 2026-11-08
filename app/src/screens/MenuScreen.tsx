// The menu of the Ink v3 boards 02, 02a, 02b, 02c and 03 (story H10b, #193): header, greeting, thali hero, sections, filter sheet, dish sheet.
import { useEffect, useState } from "react";
import { SHOW_KITCHEN_NAME } from "../lib/area";
import { categoryKey, filterDishes } from "../lib/browse";
import { sectionsOf, thalisOf } from "../lib/home";
import { creditLicence, creditLine, type Dish } from "../lib/menu";
import { formatRupees } from "../lib/money";
import { Empty, Stepper, TabBar, VegMark, useSheetFit } from "../ui";

type Props = {
  dishes: Dish[] | null; fromCache: boolean; slow?: boolean; error: string | null; onRetry: () => void;
  pin: string | null; kitchenName: string; openText: string; name: string; closed: { main: string; sub: string } | null;
  tellMe: "idle" | "busy" | "done"; tellMeError: string | null; onTellMe: () => void;   // #718: ask for one push when the closed kitchen opens
  qty: Record<string, number>; cartCount: number; cartTotal: number;
  onAdd: (id: string) => void; onChange: (id: string, delta: number) => void; onOpenCart: () => void;
  land: boolean; onLanded: () => void;   // #525: true only for the first Menu after the pin screen
  onChangePin: () => void; onOrders: () => void;
  address: string; label: string; photo: string | null; onProfile: () => void;   // story #975: the top area and the circle
};

const FunnelIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>;

export function MenuScreen(p: Props) {
  const [land] = useState(p.land);   // read once at mount, so a re-render never cuts the fly-in short
  useEffect(() => { p.onLanded(); }, []);
  const [vegOnly, setVegOnly] = useState(false);
  const [cats, setCats] = useState<string[]>([]);   // story #972: the ticked categories; none ticked is all
  const [query, setQuery] = useState("");
  const [photoBad, setPhotoBad] = useState(false);   // story #975: a photo that cannot load leaves the first letter, never a broken picture
  const [filterOpen, setFilterOpen] = useState(false);
  const [dish, setDish] = useState<Dish | null>(null);
  const where = p.address.trim() || (p.pin ? `Pin code ${p.pin}` : "Choose where to deliver");   // story #975: the one saved address until the saved list (#976) lands
  const initial = p.name.trim().charAt(0).toUpperCase();
  const all = p.dishes ?? [];
  const shown = filterDishes(all, { vegOnly, query, categories: cats });
  const thali = thalisOf(shown.filter((d) => d.available !== false));   // a sold-out thali is not today's thali
  const sections = sectionsOf(shown);
  const rank = new Map(sections.flatMap((s) => s.dishes).map((d, i) => [d.id, i] as const));   // story #921: the first two photos load at once, the rest when they near the screen
  const closed = p.closed !== null;
  const empty = p.dishes !== null && all.length === 0 && !p.error;   // story 891, board M7: the server answered and the kitchen has no dishes yet
  const add = (d: Dish) => <button type="button" className="ui-btn" aria-label={`Add ${d.name}`} disabled={closed} onClick={() => p.onAdd(d.id)}>Add</button>;
  if (p.dishes === null && p.error) return <OfflineEmpty onRetry={p.onRetry} />;   // story #637, board M6: nothing saved and no connection
  const control = (d: Dish) => d.available === false ? <span className="ui-stamp placed small" aria-label="Sold out for today">Sold out</span>
    : (p.qty[d.id] ?? 0) > 0 && !closed ? <Stepper label={d.name} value={p.qty[d.id]} onChange={(n) => p.onChange(d.id, n - p.qty[d.id])} /> : add(d);
  return (
    <>
      <header className="ui-top">
        <button type="button" className="ui-where" title="Change the delivery address" onClick={p.onChangePin}>
          <span className="ui-where-label"><svg className={`ui-pin-svg${land ? " ui-mark-land" : ""}`} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>{p.label}<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
          <span className="ui-where-line">{where}</span>
        </button>
        <button type="button" className="ui-circle" aria-label="You: your details, alerts and account" onClick={p.onProfile}>
          {p.photo && !photoBad ? <img src={p.photo} alt="" width={36} height={36} referrerPolicy="no-referrer" onError={() => setPhotoBad(true)} /> : initial || <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>}
        </button>
        <div className="ui-top-search">
          <div className="ui-search-box">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" aria-label="Search dishes" placeholder="Search dishes" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" className="ui-search-filter" aria-label="Filter the menu" onClick={() => setFilterOpen(true)}><FunnelIcon /></button>
          </div>
          <label htmlFor="veg-top" className="ui-veg-top"><span className="mono">Veg</span><input id="veg-top" className="ui-switch small" type="checkbox" role="switch" aria-label="Veg only, whole menu" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} /></label>
        </div>
      </header>
      <div className="ui-scroll" aria-busy={p.dishes === null && !p.error ? true : undefined} aria-label={p.dishes === null && !p.error ? "Loading the menu" : undefined}>
        <div className="ui-greet">
          {(SHOW_KITCHEN_NAME ? p.kitchenName : "") || p.openText ? <h2 className="ui-greet-line">{[SHOW_KITCHEN_NAME ? p.kitchenName : "", p.openText].filter(Boolean).join(" · ")}</h2> : null}
        </div>
        {closed && (
          <div className="ui-closed">
            <span className="ui-stamp placed small">Closed</span>
            <div><p className="ui-closed-main">{p.closed?.main}</p><p className="ui-closed-sub">{p.closed?.sub}</p></div>
          </div>
        )}
        {closed && (
          <div className="ui-closed-ask">
            {p.tellMe === "done" ? <p role="status">We will tell you when it opens.</p>
              : <button type="button" className="ui-btn small" disabled={p.tellMe === "busy"} onClick={p.onTellMe}>Tell me when it opens</button>}
            {p.tellMeError && <p role="alert" className="ui-closed-sub">{p.tellMeError}</p>}
          </div>
        )}
        {p.fromCache && <p role="status" className="ui-offline">{p.slow ? "GoServe is slow right now. Showing the menu you saw last." : "No connection. Showing the menu you saw last."}</p>}
                {p.dishes === null && !p.error && <Loading />}
        {p.dishes !== null && (thali.veg || thali.nonveg) && <Hero veg={thali.veg} nonveg={thali.nonveg} closed={closed} qty={p.qty} onAdd={p.onAdd} onChange={p.onChange} />}
        {empty && (
          <div className="ui-menu-empty" data-testid="menu-empty">
            <div className="ui-menu-empty-row">
              <span className="ui-stamp placed small">Soon</span>
              <div>
                <h2>No dishes on the menu yet.</h2>
                <p>{p.kitchenName || "This kitchen"} is still adding its dishes. Nothing to order right now.</p>
              </div>
            </div>
            {p.tellMe === "done" ? <p role="status">We will tell you when the menu is ready.</p>
              : <button type="button" className="ui-btn ghost" disabled={p.tellMe === "busy"} onClick={p.onTellMe}>Tell me when the menu is ready</button>}
            {p.tellMeError && <p role="alert" className="ui-meta">{p.tellMeError}</p>}
          </div>
        )}
        {empty && <p className="ui-menu-empty-note mono">Nothing listed yet.</p>}
        {p.dishes !== null && all.length > 0 && shown.length === 0 && <div className="ui-pad"><Empty title="Nothing matches" hint="Try another word or clear the filters." /></div>}
        {sections.map((s) => (
          <div key={s.id}>
            <div className="ui-section"><h2 id={s.id}>{s.title}</h2></div>
            <div className="ui-list">
              {s.dishes.map((d) => (
                <article key={d.id} className={d.available === false ? "ui-tile sold" : "ui-tile"}>
                  <button type="button" className="ui-photo-btn" aria-label={`${d.name} details`} onClick={() => setDish(d)}>
                    <Photo src={d.image_url} cls="ui-photo" lazy={(rank.get(d.id) ?? 9) >= 2} box={76} />
                  </button>
                  <div className="ui-tile-body">
                    <h3>{d.veg !== undefined && <VegMark veg={d.veg} />}{d.name}</h3>
                    {d.description && <p className="ui-meta">{d.description}</p>}
                    <p className="ui-price">{formatRupees(d.price_paise)}</p>
                  </div>
                  {control(d)}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
      {empty && <div className="ui-menu-empty-foot"><button type="button" className="ui-btn ghost big" onClick={p.onChangePin}>Try another pin code</button></div>}
      {p.cartCount > 0 && (
        <div className="ui-sticky float">
          <button type="button" className="ui-btn bar" aria-label={`View bill (${p.cartCount}) · ${formatRupees(p.cartTotal)}`} onClick={p.onOpenCart}>
            <span className="mono">{p.cartCount} {p.cartCount === 1 ? "item" : "items"} · {formatRupees(p.cartTotal)}</span><span className="verb">View bill ›</span>
          </button>
        </div>
      )}
      <TabBar current="menu" onMenu={() => undefined} onOrders={p.onOrders} />
      {filterOpen && (
        <FilterSheet count={shown.length} total={all.length} vegOnly={vegOnly} onVeg={setVegOnly}
          sections={sectionsOf(all)} ticked={cats} onTick={(k, on) => setCats((cur) => (on ? [...cur, k] : cur.filter((x) => x !== k)))} onClear={() => setCats([])} onClose={() => setFilterOpen(false)} />
      )}
      {dish && <DishSheet dish={dish} closed={closed} qty={p.qty[dish.id] ?? 0} onAdd={(n) => { for (let i = 0; i < n; i++) p.onAdd(dish.id); setDish(null); }} onClose={() => setDish(null)} />}
    </>
  );
}

// A photo that is missing or cannot load shows the plate, never the browser's broken-image mark (story #637).
function Photo({ src, cls, alt = "", lazy, box }: { src: string | null; cls?: string; alt?: string; lazy?: boolean; box?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${cls ?? ""} ui-ph`} aria-hidden="true">
        <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="var(--md-outline)" strokeWidth="1.5"><circle cx="24" cy="24" r="18" /><circle cx="24" cy="24" r="11" /></svg>
      </span>
    );
  }
  return <img className={cls} src={src} alt={alt} loading={lazy === undefined ? undefined : lazy ? "lazy" : "eager"} decoding={box ? "async" : undefined} width={box} height={box} onError={() => setFailed(true)} />;
}

// Board M6: no connection and no saved menu. The whole screen, no header, no tabs.
function OfflineEmpty({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ui-offline-empty">
      <svg aria-hidden="true" viewBox="0 0 240 180" width="240" height="180" fill="none" stroke="var(--md-on-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 118h160" stroke="var(--md-outline-variant)" />
        <path d="M60 110c0-26 27-40 60-40s60 14 60 40z" fill="var(--md-surface-variant)" />
        <path d="M60 110h120" />
        <path d="M180 92l34-14" />
        <circle cx="216" cy="77" r="4" fill="var(--md-on-surface)" />
        <ellipse cx="120" cy="96" rx="30" ry="9" fill="var(--gs-status-cooking)" />
        <path d="M84 118v18M156 118v18" />
        <path d="M78 136h12M150 136h12" />
        <path d="M120 30c-8 0-14 6-14 14" stroke="var(--md-outline)" strokeDasharray="2 4" />
        <path d="M120 16c-16 0-28 12-28 28" stroke="var(--md-outline)" strokeDasharray="2 4" />
        <path d="M120 2c-24 0-42 18-42 42" stroke="var(--md-outline)" strokeDasharray="2 4" />
        <path d="M128 28l18 18M146 28l-18 18" stroke="var(--md-error)" />
      </svg>
      <div role="alert">
        <p className="ui-offline-title">Could not connect to the internet.</p>
        <p className="ui-offline-line">Check your network, then try again.</p>
      </div>
      <button type="button" className="ui-btn ghost" onClick={onRetry}>Try again</button>
    </div>
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

function Hero({ veg, nonveg, closed, qty, onAdd, onChange }: { veg?: Dish; nonveg?: Dish; closed: boolean; qty: Record<string, number>; onAdd: (id: string) => void; onChange: (id: string, delta: number) => void }) {
  // Story #608: the thali card has the same Add and stepper as every other dish.
  const page = (d: Dish, id: string) => (
    <div className="page" id={id} key={id}>
      <div className="photo"><Photo src={d.image_url} alt={d.name} /><span className="ui-tag">Today</span></div>
      <div className="body">
        <div><h3>{d.veg !== undefined && <VegMark veg={d.veg} />}{d.name}</h3><p className="price-pair"><span className="ui-price">{formatRupees(d.price_paise)}</span></p></div>
        {(qty[d.id] ?? 0) > 0 && !closed
          ? <Stepper label={d.name} value={qty[d.id]} onChange={(n) => onChange(d.id, n - qty[d.id])} />
          : <button type="button" className="ui-btn" aria-label={`Add ${d.name}`} disabled={closed} onClick={() => onAdd(d.id)}>Add</button>}
      </div>
    </div>
  );
  // Story 779: the switch follows the page that is showing, so a swipe moves the tint too (the owner, 3 Nov: it did not follow the swipe).
  const [side, setSide] = useState<"veg" | "nonveg">("veg");
  return (
    <section className="ui-hero" aria-label="Today's thali">
      {veg && nonveg && (
        <nav className="ui-seg" aria-label="Veg or non-veg thali">
          <a href="#thali-veg" className={side === "veg" ? "on" : ""} aria-label="Veg thali"><VegMark veg /></a>
          <a href="#thali-nonveg" className={side === "nonveg" ? "nonveg on" : "nonveg"} aria-label="Non-veg thali"><VegMark veg={false} /></a>
        </nav>
      )}
      <div className="pager" onScroll={(e) => { const el = e.currentTarget; if (veg && nonveg) setSide(el.scrollLeft > el.clientWidth / 2 ? "nonveg" : "veg"); }}>{veg && page(veg, "thali-veg")}{nonveg && page(nonveg, "thali-nonveg")}</div>
    </section>
  );
}

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const fit = useSheetFit();   // story #954: the overlay follows the visual viewport
  return (
    <div ref={fit} className="ui-sheet-back" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={label} className="ui-sheet ui-sheet-flush" onClick={(e) => e.stopPropagation()}>{children}</section>
    </div>
  );
}

// Story #972, board F1-Filter: a checkbox per category (multi-select, none ticked is all), the veg switch for the whole menu, the count of what matches, Show n dishes.
function FilterSheet({ count, total, vegOnly, onVeg, sections, ticked, onTick, onClear, onClose }: { count: number; total: number; vegOnly: boolean; onVeg: (v: boolean) => void; sections: { id: string; title: string; dishes: Dish[] }[]; ticked: string[]; onTick: (key: string, on: boolean) => void; onClear: () => void; onClose: () => void }) {
  return (
    <Modal label="Filter" onClose={onClose}>
      <div className="ui-sheet-head"><h2>Filter</h2><span className="mono ui-count">{count} of {total} dishes</span></div>
      <div className="ui-switch-row">
        <label htmlFor="veg" className="ui-switch-label">Veg only <span className="mono ui-switch-note">· whole menu, thali too</span></label>
        <input id="veg" className="ui-switch" type="checkbox" role="switch" checked={vegOnly} onChange={(e) => onVeg(e.target.checked)} />
      </div>
      <div role="group" aria-label="Categories" className="ui-cats">
        {sections.map((s) => {
          const key = categoryKey(s.dishes[0]);
          const on = ticked.includes(key);
          return (
            <label key={s.id} htmlFor={`cat-${s.id}`} className="ui-row ui-cat-row">
              <input id={`cat-${s.id}`} type="checkbox" checked={on} onChange={(e) => onTick(key, e.target.checked)} />
              <span className={on ? "on" : ""}>{s.title}</span><span className="mono ui-count">{s.dishes.length}</span>
            </label>
          );
        })}
        {ticked.length > 0 && <a href="#" className="mono ui-clear" onClick={(e) => { e.preventDefault(); onClear(); }}>Clear all</a>}
      </div>
      <button type="button" className="ui-btn big" onClick={onClose}>Show {count} {count === 1 ? "dish" : "dishes"}</button>
    </Modal>
  );
}

function DishSheet({ dish, closed, qty, onAdd, onClose }: { dish: Dish; closed: boolean; qty: number; onAdd: (n: number) => void; onClose: () => void }) {
  const [n, setN] = useState(Math.max(1, qty ? 1 : 1));
  return (
    <Modal label={dish.name} onClose={onClose}>
      <Photo src={dish.image_url} cls="ui-dish-photo" />
      <div className="ui-dish-body">
        <div className="ui-dish-head"><h2>{dish.veg !== undefined && <VegMark veg={dish.veg} size={14} />}{dish.name}</h2><span className="ui-dish-price">{formatRupees(dish.price_paise)}</span></div>
        <p className="ui-kicker">{dish.veg === undefined ? "" : dish.veg ? "Veg" : "Non-veg"}{dish.category ? ` · ${dish.category}` : ""}</p>
        {dish.description && <p className="ui-meta">{dish.description}</p>}
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
