// Story 1669 (epic 1652), board k4door: the rider types the customer's 4 digit code at the door. The fourth digit checks it; there is no button.
// The right code ends the sheet and the order is Delivered; the lines are the owner-approved words (the wrong-code line is the kitchen sheet's, for the customer).
import { useEffect, useRef, useState } from "react";
import { Sheet } from "../ui";
import { CodeBoxes } from "../ui/CodeBoxes";
import { riderDeliver } from "../lib/handoverCode";

const LINES = {
  wrong: "That code does not match this order. Ask the customer to read it again.",
  locked: "Too many wrong codes. This code is locked. Ask your admin to mark this order delivered.",
  net: "We could not check the code. Check your internet and type it again.",
  off: "The customer's code is switched off now. Close this and mark the order Delivered, as before.",
} as const;
export const SWITCHED_ON = "The customer's code is switched on now. Ask the customer for the 4 digit code on their order screen.";

export function DoorCodeSheet({ orderId, short, method, notice, supportPhone, onDelivered, onClose }: { orderId: string; short: string; method: string; notice?: boolean; supportPhone?: string | null; onDelivered: () => void; onClose: () => void }) {
  const [line, setLine] = useState<string | null>(null);
  const [kind, setKind] = useState<"idle" | "checking" | "wrong" | "locked" | "other">("idle");
  const [reset, setReset] = useState(0);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const check = async (code: string) => {
    setKind("checking"); setLine(null);
    const a = await riderDeliver(orderId, code, method);
    if (!live.current) return;
    if (a.kind === "ok") { onDelivered(); return; }
    setKind(a.kind === "locked" ? "locked" : a.kind === "wrong" ? "wrong" : "other");
    setLine(a.kind === "other" ? a.message : LINES[a.kind]);
    if (a.kind !== "locked") setReset((n) => n + 1);
  };
  return (
    <Sheet open title="Customer's code" onClose={onClose}>
      <p className="ui-sheet-lead">Ask the customer for the 4 digit code on their order screen. Order {short}</p>
      <CodeBoxes resetKey={reset} disabled={kind === "locked" || kind === "checking"} invalid={kind === "wrong" || kind === "locked"} onFull={(c) => void check(c)} />
      <p role={line ? "alert" : notice ? "status" : undefined} className={line || !notice ? "ui-field-error ui-code-line" : "ui-meta ui-code-line"}>{line ?? (notice ? SWITCHED_ON : null)}</p>
      {supportPhone && <a className="ui-rx-link" href={`tel:${supportPhone}`}>Call GoServe</a>}   {/* story 1671: the way out is a call; an admin marks it Delivered. The rider has no skip. */}
    </Sheet>
  );
}
