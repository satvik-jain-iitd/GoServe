// The Feedback button and its sheet (story S-B, #94). A tester tells us what went wrong in ten seconds, without leaving the app.
// Story 1751: words only for now (the picture comes with its own story). The words, the screen, the order and the last 20 taps are saved by the database function.
import { useEffect, useState } from "react";
import { useBackCloses } from "../lib/back";
import { useSheetFit } from "../ui";
import { buildPayload, defaultTopic, flushQueue, queueReport, SAVED_CARD, SENT_CARD, TEXT_MAX, topicsFor, type Doing, type Report } from "../lib/feedback";
import { PlaceError } from "../lib/orders";
import { readTrail } from "../lib/trail";

type Props = {
  role: string;
  button?: boolean;   // #242: the floating button is the console's; the apps open the sheet from a Send feedback row (gs-feedback)
  screen: string;
  order: { id: string; status: string } | null;
  getSession: () => Promise<string>;
  send: (report: Report) => Promise<unknown>;
};

const BUILD = import.meta.env.VITE_BUILD ?? "dev";
const phoneName = () => (navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? "unknown").slice(0, 80);

export function FeedbackSheet({ role, screen, order, getSession, send, button = true }: Props) {
  const fit = useSheetFit();   // story #954: the overlay follows the visual viewport
  const [open, setOpen] = useState(false);
  useBackCloses(open, () => setOpen(false));   // story 1415
  const [text, setText] = useState("");
  const [topic, setTopic] = useState(() => defaultTopic(role));   // story #661: the list is per app
  const topics = topicsFor(role);
  const doing: Doing = topics.find((t) => t.label === topic)?.doing ?? "other";
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<{ title: string; line: string } | null>(null);   // story #642: shown after the sheet closes
  const [error, setError] = useState<string | null>(null);

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
      const report = buildPayload({ text, doing, topic, role, screen, session: await getSession(), order, build: BUILD, phone: phoneName(), online: navigator.onLine, now: new Date(), trail: readTrail() });
      try {
        await send(report);
        setCard(SENT_CARD);
      } catch (e) {
        if (!(e instanceof PlaceError && e.code === "network")) throw e;
        if (!queueReport(window.localStorage, report)) throw new Error("This phone has no room to keep the report. Try again when you are online.");
        setCard(SAVED_CARD);
      }
      setText("");
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
        <div ref={fit} className="ui-sheet-back">
          <div role="dialog" aria-modal="true" aria-label="Feedback" className="ui-sheet">
            <div className="ui-sheet-head"><h2>Feedback</h2></div>
            <div className="ui-form ui-form-flush">
              <div className="ui-field"><label htmlFor="fb-text">What happened?</label>
                <textarea id="fb-text" value={text} maxLength={TEXT_MAX} rows={4} onChange={(e) => setText(e.target.value)} />
              </div>
              <div className="ui-field"><label htmlFor="fb-doing">What were you doing?</label>
                <select id="fb-doing" value={topic} onChange={(e) => setTopic(e.target.value)}>
                  {topics.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
              </div>
              {error && <p role="alert" className="ui-field-error">{error}</p>}
              <div className="ui-row-pair">   {/* story 1701: Close left, Send last (right), equal halves */}
                <button type="button" className="ui-btn ghost" onClick={() => setOpen(false)}>Close</button>
                <button type="button" className="ui-btn" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {card && <div role="status" className={`feedback-sent${button ? " above-btn" : ""}`} data-testid="feedback-sent"><div className="feedback-sent-title">{card.title}</div><div>{card.line}</div></div>}
    </>
  );
}
