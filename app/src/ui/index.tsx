// GoServe design system (story D1, #160). Every screen is built from these. Look and spacing come from ui.css and the tokens.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

export function Button({ variant = "primary", size, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost"; size?: "big" }) {
  return <button type="button" {...p} className={cx("ui-btn", variant === "ghost" && "ghost", size === "big" && "big", className)} />;
}

export function AppBar({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <header className="ui-appbar">
      {onBack && <button type="button" className="ui-back" aria-label="Back" onClick={onBack}>‹</button>}
      <h1>{title}</h1>
      {action}
    </header>
  );
}

export function Tile({ title, meta, price, image, veg, children }: { title: string; meta?: string; price?: string; image?: string; veg?: boolean; children?: ReactNode }) {
  return (
    <article className="ui-tile">
      {image ? <img src={image} alt="" loading="lazy" /> : <div className="ui-photo" aria-hidden="true" />}
      <div className="ui-tile-body">
        <h3>{veg !== undefined && <span className={cx("ui-dot", veg ? "veg" : "nonveg")} role="img" aria-label={veg ? "Veg" : "Non-veg"} />}{title}</h3>
        {meta && <p className="ui-meta">{meta}</p>}
        {price && <p className="ui-price">{price}</p>}
      </div>
      {children && <div className="ui-tile-act">{children}</div>}
    </article>
  );
}

export function Chip({ selected, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" {...p} className={cx("ui-chip", selected && "on")} aria-pressed={!!selected}>{children}</button>;
}

export function Stepper({ label, value, onChange, min = 0, max = 20 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="ui-step">
      <button type="button" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span role="status" aria-label={`Quantity of ${label}`}>{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export function StickyBar({ children }: { children: ReactNode }) {
  return <div className="ui-sticky">{children}</div>;
}

export function Timeline({ steps, current, label }: { steps: string[]; current: number; label?: string }) {
  return (
    <ol className="ui-timeline" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className={i < current ? "done" : i === current ? "now" : "next"} aria-current={i === current ? "step" : undefined}>{s}</li>
      ))}
    </ol>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="ui-sheet-back" onClick={onClose}>
      <section className="ui-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ui-sheet-head"><h2>{title}</h2><Button variant="ghost" onClick={onClose}>Close</Button></div>
        {children}
      </section>
    </div>
  );
}

export function Empty({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="ui-empty">
      <h2>{title}</h2>
      {hint && <p className="ui-meta">{hint}</p>}
      {children}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ui-skel" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${100 - i * 15}%` }} />)}
    </div>
  );
}

// The veg / non-veg mark of the Ink boards (story H10b, #193). Colour comes from the tokens.
export function VegMark({ veg, size = 12 }: { veg: boolean; size?: number }) {
  const c = veg ? "var(--gs-veg)" : "var(--gs-nonveg)";
  return (
    <svg className="ui-mark" role="img" aria-label={veg ? "Veg" : "Non-veg"} width={size} height={size} viewBox="0 0 12 12">
      <rect x="0.75" y="0.75" width="10.5" height="10.5" fill="none" stroke={c} strokeWidth="1.5" />
      {veg ? <circle cx="6" cy="6" r="3" fill={c} /> : <path d="M6 2.5 9.5 9h-7z" fill={c} />}
    </svg>
  );
}

const TAB_ICONS = {
  menu: <><path d="M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  orders: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  you: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  job: <><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17l4-8h5l3 8M10 9l-2-4h3" /></>,
  today: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  new: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h5" /></>,
  cooking: <><path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" /><path d="M9 4v3M12 3v4M15 4v3" /></>,
  kitchen: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>,
};
export type TabIcon = keyof typeof TAB_ICONS;
// Bottom tabs of the rider and kitchen apps (story H11, #194): the visible word is the accessible name.
export function Tabs<K extends string>({ current, tabs, onPick }: { current: K; tabs: { key: K; label: string; icon: TabIcon; badge?: number }[]; onPick: (k: K) => void }) {
  return (
    <nav className="ui-tabs" aria-label="Main">
      {tabs.map((t) => (
        <button key={t.key} type="button" className={cx("ui-tab", current === t.key && "on")} aria-current={current === t.key ? "page" : undefined} onClick={() => onPick(t.key)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TAB_ICONS[t.icon]}</svg>{t.label}
          {t.badge ? <span className="ui-tab-badge" aria-label={`${t.badge} new`}>{t.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}
// Bottom tabs of the customer app. The aria-labels keep the names the tests already use ("My orders", "Account").
export function TabBar({ current, onMenu, onOrders, onYou }: { current: "menu" | "orders" | "you"; onMenu: () => void; onOrders: () => void; onYou: () => void }) {
  const tabs = [
    { key: "menu" as const, label: "Menu", name: "Menu", go: onMenu },
    { key: "orders" as const, label: "Orders", name: "My orders", go: onOrders },
    { key: "you" as const, label: "You", name: "You (Account)", go: onYou },
  ];
  return (
    <nav className="ui-tabs" aria-label="Main">
      {tabs.map((t) => (
        <button key={t.key} type="button" className={cx("ui-tab", current === t.key && "on")} aria-label={t.name} aria-current={current === t.key ? "page" : undefined} onClick={t.go}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TAB_ICONS[t.key]}</svg>{t.label}
        </button>
      ))}
    </nav>
  );
}
