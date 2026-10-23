// GoServe design system (story D1, #160). Every screen is built from these. Look and spacing come from ui.css and the tokens.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return <button type="button" {...p} className={cx("ui-btn", variant === "ghost" && "ghost", className)} />;
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
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export function StickyBar({ children }: { children: ReactNode }) {
  return <div className="ui-sticky">{children}</div>;
}

export function Timeline({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="ui-timeline">
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
