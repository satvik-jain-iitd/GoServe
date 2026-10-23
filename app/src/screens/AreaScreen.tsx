// The first question of the customer app (story B2): where to deliver. Answered once; "Change area" asks again.
import { useState } from "react";
import { isPin, openingText } from "../lib/area";
import type { Area } from "../lib/area";

type Props = { pin: string | null; area: Area | null; busy: boolean; error: string | null; onPin: (pin: string) => void };

export function AreaScreen({ pin, area, busy, error, onPin }: Props) {
  const [text, setText] = useState(pin ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <section>
      <h2>Where should we deliver?</h2>
      <label>Pin code<input inputMode="numeric" maxLength={6} value={text} onChange={(e) => setText(e.target.value.trim())} /></label>
      <button type="button" className="btn" disabled={busy} onClick={() => (isPin(text) ? (setProblem(null), onPin(text)) : setProblem("A pin code is six digits."))}>Show kitchen</button>
      {busy && <p>Finding your kitchen…</p>}
      {(problem || error) && <p role="alert" className="error">{problem ?? error}</p>}
      {area?.kind === "none" && <p role="status">We are not in {pin} yet. We saved your pin code and will tell you when we arrive.</p>}
      {area?.kind === "closed" && <p role="status">{openingText(area.name, area.opens_at)}</p>}
    </section>
  );
}
