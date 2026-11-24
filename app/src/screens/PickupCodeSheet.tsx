// Story 1667 (epic 1652), board k3code: the cook types the rider's 4 digit code. The fourth digit checks it; there is no button.
// Right: a tick, "Given to the rider", the sheet closes by itself. Wrong: boxes empty and red, one red line. The lines are the owner-approved words.
import { useEffect, useRef, useState } from "react";
import { Sheet } from "../ui";
import { CodeBoxes } from "../ui/CodeBoxes";
import { kitchenHandover } from "../lib/handoverCode";

const LINES = {
  wrong: "That code does not match this order. Ask the rider to read it again.",
  locked: "Too many wrong codes. This code is locked. Ask your admin to hand this order over.",
  net: "We could not check the code. Check your internet and type it again.",
  off: "The hand-over code is switched off now. The rider can tap Picked up, as before.",
} as const;

export function PickupCodeSheet({ orderId, ticket, short, onHandedOver, onClose }: { orderId: string; ticket: string; short: string; onHandedOver: () => void; onClose: () => void }) {
  const [line, setLine] = useState<string | null>(null);
  const [kind, setKind] = useState<"idle" | "checking" | "wrong" | "locked" | "other" | "done">("idle");
  const [reset, setReset] = useState(0);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const check = async (code: string) => {
    setKind("checking"); setLine(null);
    const a = await kitchenHandover(orderId, code);
    if (!live.current) return;
    if (a.kind === "ok") { setKind("done"); onHandedOver(); return; }
    setKind(a.kind === "locked" ? "locked" : a.kind === "wrong" ? "wrong" : "other");
    setLine(a.kind === "other" ? a.message : LINES[a.kind]);
    if (a.kind !== "locked") setReset((n) => n + 1);   // empty boxes to type again
  };
  useEffect(() => { if (kind !== "done") return; const t = setTimeout(onClose, 1500); return () => clearTimeout(t); }, [kind, onClose]);
  if (kind === "done") return (
    <Sheet open title="Handed over" onClose={onClose}>
      <div role="status" className="ui-done-row">
        <span className="ui-done-tick" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg></span>
        <div><b>Given to the rider</b><p>Order {short} is on the way.</p></div>
      </div>
    </Sheet>
  );
  return (
    <Sheet open title="Rider's code" onClose={onClose}>
      <p className="ui-sheet-lead">Ask the rider for the 4 digit code. Order {short} · {ticket}</p>
      <CodeBoxes resetKey={reset} disabled={kind === "locked" || kind === "checking"} invalid={kind === "wrong" || kind === "locked"} onFull={(c) => void check(c)} />
      <p role={line ? "alert" : undefined} className="ui-field-error ui-code-line">{line}</p>
    </Sheet>
  );
}
