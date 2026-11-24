// Story 1667 and 1669 (epic 1652): the four boxes of the hand-over code sheets. No button: the code goes out by itself on the last digit.
// A new resetKey empties the boxes (a wrong code, a failed read); disabled puts them to sleep (locked).
import { useEffect, useRef, useState } from "react";

export function CodeBoxes({ length = 4, disabled, invalid, resetKey, onFull }: { length?: number; disabled?: boolean; invalid?: boolean; resetKey: number; onFull: (code: string) => void }) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const off = useRef(disabled);
  off.current = disabled;   // the latest value, without clearing the boxes whenever it changes
  useEffect(() => { setDigits(Array(length).fill("")); if (!off.current) boxes.current[0]?.focus(); }, [resetKey, length]);
  const set = (i: number, value: string) => {
    const only = value.replace(/\D/g, "");
    const next = [...digits];
    if (!only) next[i] = "";
    else only.slice(0, length - i).split("").forEach((c, k) => { next[i + k] = c; });   // a pasted code fills the boxes from here
    setDigits(next);
    if (only) boxes.current[Math.min(i + only.length, length - 1)]?.focus();
    if (next.every((d) => d)) onFull(next.join(""));
  };
  return (
    <div className="ui-code-boxes">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { boxes.current[i] = el; }} aria-label={`Digit ${i + 1}`} className="mono-input" type="text" inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"} value={d} disabled={disabled} aria-invalid={invalid ? true : undefined}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}
