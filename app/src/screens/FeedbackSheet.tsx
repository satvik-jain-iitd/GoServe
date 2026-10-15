// The Feedback button and its sheet (story S-B, #94). A tester tells us what went wrong in ten seconds, without leaving the app.
// The picture is the phone's own screenshot, picked from the gallery. The words, the screen, the order and the last 20 taps go with it.
import { useEffect, useState } from "react";
import { buildPayload, DOING, flushQueue, pictureToBase64, queueReport, TEXT_MAX, type Doing, type Report } from "../lib/feedback";
import { PlaceError } from "../lib/orders";
import { readTrail } from "../lib/trail";

type Props = {
  role: string;
  screen: string;
  order: { id: string; status: string } | null;
  getSession: () => Promise<string>;
  send: (report: Report) => Promise<unknown>;
};

const BUILD = import.meta.env.VITE_BUILD ?? "dev";
const phoneName = () => (navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? "unknown").slice(0, 80);

export function FeedbackSheet({ role, screen, order, getSession, send }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [doing, setDoing] = useState<Doing>("other");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reports saved while the phone was offline go out when the app opens and when the phone is back online.
  useEffect(() => {
    const flush = () => void flushQueue(window.localStorage, send).catch(() => undefined);
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const image = file ? await pictureToBase64(file) : undefined;
      const report = buildPayload({ text, doing, role, screen, session: await getSession(), order, build: BUILD, phone: phoneName(), online: navigator.onLine, now: new Date(), trail: readTrail(), image });
      try {
        await send(report);
        setMessage("Thanks, saved.");
      } catch (e) {
        if (!(e instanceof PlaceError && e.code === "network")) throw e;
        if (!queueReport(window.localStorage, report)) throw new Error("This phone has no room to keep the report. Try again when you are online.");
        setMessage("Saved on this phone. It will send when you are back online.");
      }
      setText("");
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn small feedback-btn" onClick={() => { setOpen(true); setMessage(null); setError(null); }}>Feedback</button>
      {open && (
        <div className="sheet-back">
          <div role="dialog" aria-modal="true" aria-label="Feedback" className="sheet">
            <h2>Feedback</h2>
            <label className="field">What happened?
              <textarea value={text} maxLength={TEXT_MAX} rows={4} onChange={(e) => setText(e.target.value)} />
            </label>
            <label className="field">What were you doing?
              <select value={doing} onChange={(e) => setDoing(e.target.value as Doing)}>
                {DOING.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
              </select>
            </label>
            <label className="field">Add a screenshot
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <span className="note">Take a screenshot with your phone buttons first, then pick it here. It is optional.</span>
            </label>
            {message && <p role="status" className="note">{message}</p>}
            {error && <p role="alert" className="error">{error}</p>}
            <div className="demobar">
              <button type="button" className="btn" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send"}</button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
