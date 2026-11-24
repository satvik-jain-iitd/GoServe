// Story 1319 (owner approved notpaid-frames): the rider says why the money did not come. The food was handed over, so the order ends Delivered with a money-due mark.
// Four full-width rows, one pick; Other asks for words (1 to 200). Red Not collected on the left stays asleep until a reason is picked; Go back on the right.
import { useState } from "react";
import { Sheet } from "../ui";
import { getClient } from "../lib/supabase";
import { riderMoneyNotCollected } from "../lib/rider";
import { useBackCloses } from "../lib/back";

const REASONS = [["says_already_paid", "Says it is already paid"], ["will_pay_later", "Will pay later"], ["did_not_have_money", "Did not have the money"], ["other", "Other"]] as const;
const LINES: Record<string, string> = {
  code_required: "The customer's code is switched on now. Close this and use Took cash with the customer's code.",
  not_ready: "This order is not out for delivery any more.",
};

export function MoneyNotCollectedSheet({ orderId, short, amount, onDone, onClose }: { orderId: string; short: string; amount: string; onDone: () => void; onClose: () => void }) {
  useBackCloses(true, onClose);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const words = note.trim();
  const ready = reason !== null && (reason !== "other" || (words.length >= 1 && words.length <= 200));
  const send = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(null);
    const failed = await riderMoneyNotCollected(getClient(), orderId, reason!, reason === "other" ? words : null);
    setBusy(false);
    if (failed === null) onDone(); else setErr(LINES[failed] ?? "We could not save this. Check your internet and try again.");
  };
  return (
    <Sheet open title="Money not collected" onClose={onClose}>
      <p className="ui-sheet-lead">Order {short} · {amount}. Why? Pick one.</p>
      <div role="radiogroup" aria-label="Why the money was not collected" className="ui-money-rows">
        {REASONS.map(([key, label]) => (
          <label key={key} className="ui-pay-row"><input type="radio" name="money-why" checked={reason === key} onChange={() => setReason(key)} /><span>{label}</span></label>
        ))}
      </div>
      {reason === "other" && <div className="ui-field"><label htmlFor="money-note">Say why</label><input id="money-note" type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>}
      {err && <p role="alert" className="ui-field-error">{err}</p>}
      <div className="ui-sheet-acts">
        <div className="ui-row-pair">
          <button type="button" className="ui-btn big danger-fill" disabled={!ready || busy} onClick={() => void send()}>Not collected</button>
          <button type="button" className="ui-btn ghost big" onClick={onClose}>Go back</button>
        </div>
      </div>
    </Sheet>
  );
}
