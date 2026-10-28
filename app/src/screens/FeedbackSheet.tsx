// The Feedback button and its sheet (story S-B, #94). A tester tells us what went wrong in ten seconds, without leaving the app.
// The picture is the phone's own screenshot, picked from the gallery. The words, the screen, the order and the last 20 taps go with it.
import { useEffect, useState } from "react";
import { buildPayload, defaultTopic, flushQueue, pictureToBase64, queueReport, SAVED_CARD, SENT_CARD, TEXT_MAX, topicsFor, type Doing, type Report } from "../lib/feedback";
import { PlaceError } from "../lib/orders";
import { readTrail } from "../lib/trail";

type Props = {
  role: string;
  button?: boolean;   // #242: the floating button is the console's; the apps open the sheet from a Send feedback row (gs-feedback)
  screen: string;
  order: { id: string; status: string } | null;
  getSession: () => Promise<string>;
  send: (report: Report) => Promise<unknown>;
  preset?: { nonce: number; text: string; doing: Doing };   // opens the sheet with these words (the third Not yet, story S-C)
};

const BUILD = import.meta.env.VITE_BUILD ?? "dev";
const phoneName = () => (navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? "unknown").slice(0, 80);

export function FeedbackSheet({ role, screen, order, getSession, send, preset, button = true }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState(() => defaultTopic(role));   // story #661: the list is per app
  const topics = topicsFor(role);
  const doing: Doing = topics.find((t) => t.label === topic)?.doing ?? "other";
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<{ title: string; line: string } | null>(null);   // story #642: shown after the sheet closes
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preset) return;
    setText(preset.text);
    setTopic(topics.find((t) => t.label && t.doing === preset.doing)?.label ?? defaultTopic(role));
    setError(null);
    setOpen(true);
  }, [preset?.nonce]);

  // The You screen opens the sheet with an event (story H10d).
  useEffect(() => {
    const show = () => { setError(null); setOpen(true); };
    window.addEventListener("gs-feedback", show);
    return () => window.removeEventListener("gs-feedback", show);
  }, []);

  // The card goes after 6 s or at the next tap anywhere.
  useEffect(() => {
    if (!card) return;
    const t = window.setTimeout(() => setCard(null), 6000);
    const away = () => setCard(null);
    document.addEventListener("pointerdown", away);
    return () => { window.clearTimeout(t); document.removeEventListener("pointerdown", away); };
  }, [card]);

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
    setCard(null);
    try {
      const image = file ? await pictureToBase64(file) : undefined;
      const report = buildPayload({ text, doing, topic, role, screen, session: await getSession(), order, build: BUILD, phone: phoneName(), online: navigator.onLine, now: new Date(), trail: readTrail(), image });
      try {
        await send(report);
        setCard(SENT_CARD);
      } catch (e) {
        if (!(e instanceof PlaceError && e.code === "network")) throw e;
        if (!queueReport(window.localStorage, report)) throw new Error("This phone has no room to keep the report. Try again when you are online.");
        setCard(SAVED_CARD);
      }
      setText("");
      setFile(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {button && <button type="button" className="btn small feedback-btn" onClick={() => { setOpen(true); setError(null); }}>Feedback</button>}
      {open && (
        <div className="sheet-back">
          <div role="dialog" aria-modal="true" aria-label="Feedback" className="sheet">
            <h2>Feedback</h2>
            <label className="field">What happened?
              <textarea value={text} maxLength={TEXT_MAX} rows={4} onChange={(e) => setText(e.target.value)} />
            </label>
            <label className="field">What were you doing?
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                {topics.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </label>
            <label className="field">Add a screenshot (optional)
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <span className="note">Take one with your phone buttons first, then pick it here.</span>
            </label>
            {error && <p role="alert" className="error">{error}</p>}
            <div className="demobar">
              <button type="button" className="btn" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send"}</button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {card && <div role="status" className={`feedback-sent${button ? " above-btn" : ""}`} data-testid="feedback-sent"><div className="feedback-sent-title">{card.title}</div><div>{card.line}</div></div>}
    </>
  );
}
