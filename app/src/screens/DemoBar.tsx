// Demo tools (story #52): copy the link a second device opens, and reset this session after a yes.
import { useState } from "react";

type Props = { onReset: () => Promise<void>; getLink: () => Promise<string>; autoOn: boolean; autoNote: string | null; onAuto: () => void };

export function DemoBar({ onReset, getLink, autoOn, autoNote, onAuto }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(job: () => Promise<string | void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMessage((await job()) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  const copy = () => run(async () => {
    const link = await getLink();
    try {
      await navigator.clipboard.writeText(link);
      return "Link copied.";
    } catch {
      return `Copy this link: ${link}`;   // clipboard blocked: show it instead
    }
  });

  return (
    <div className="demobar">
      {asking ? (
        <>
          <span>Clear all orders of this demo?</span>
          <button type="button" className="btn small" disabled={busy} onClick={() => run(async () => { await onReset(); return "Demo cleared."; })}>Yes, clear</button>
          <button type="button" className="btn small ghost" disabled={busy} onClick={() => setAsking(false)}>No, keep</button>
        </>
      ) : (
        <>
          <button type="button" className={autoOn ? "btn small" : "btn small ghost"} aria-pressed={autoOn} onClick={onAuto}>Autopilot</button>
          <button type="button" className="btn small ghost" disabled={busy} onClick={copy}>Copy link for a second device</button>
          <button type="button" className="btn small ghost" disabled={busy} onClick={() => setAsking(true)}>Reset demo</button>
        </>
      )}
      {autoNote && <p role="status" className="note">{autoNote}</p>}
      {message && <p role="status" className="note">{message}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}
