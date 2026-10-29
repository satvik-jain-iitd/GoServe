// The phone code sheets of the Ink journeys boards O1 to O9 (story #551): number, code with a resend timer, the contract's errors, a number that is already used, the name.
import { useEffect, useRef, useState } from "react";
import { capture } from "../lib/analytics";
import { finishSignIn, isMobile, sendCode, sendSignInCode, showPhone, verifyCode, type OtpResult } from "../lib/otp";
import { getClient } from "../lib/supabase";
import { SignIn } from "./SignIn";

const RESEND_S = 30;
type Step = "number" | "code";

// `welcome` (story #667, boards O0 and O0b): the same steps as the first full screen of the app, with Google under the number and no way to close it.
export function OtpSheet({ phone: start, onVerified, onClose, welcome = false }: { phone: string; onVerified: (phone: string) => void; onClose: () => void; welcome?: boolean }) {
  const [phone, setPhone] = useState(isMobile(start) ? start : "");
  const [step, setStep] = useState<Step>("number");
  const [mode, setMode] = useState<"link" | "signin">("link");   // signin = the returning customer (O7)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<OtpResult & { ok: false } | null>(null);
  const [busy, setBusy] = useState(false);
  const [until, setUntil] = useState(0);   // the time the resend opens
  const [now, setNow] = useState(() => Date.now());
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const guest = useRef("");

  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));

  const locked = error?.error === "too_many_sends";
  const code = digits.join("");
  const fail = (r: OtpResult) => { setError(r.ok ? null : r); return r.ok; };

  async function send(m = mode) {
    setBusy(true);
    setError(null);
    const ok = fail(m === "signin" ? await sendSignInCode(phone) : await sendCode(phone));
    setBusy(false);
    if (!ok) return;
    setDigits(Array(6).fill(""));
    setStep("code");
    setNow(Date.now());
    setUntil(Date.now() + RESEND_S * 1000);
  }
  async function verify() {
    setBusy(true);
    setError(null);
    const r = mode === "signin" ? await finishSignIn(phone, code, guest.current) : await verifyCode(phone, code);
    setBusy(false);
    if (r.ok) { capture("code_ok"); onVerified(phone); }
    else setError(r);
  }
  async function signInInstead() {
    setBusy(true);   // the boxes wait (disabled) until the new code is on its way, so nothing typed is wiped by the reset
    guest.current = (await getClient().auth.getSession()).data.session?.access_token ?? "";   // the guest's orders move with this token
    setMode("signin");
    await send("signin");
  }
  function typeAt(i: number, value: string) {
    const only = value.replace(/\D/g, "");
    if (!only) return setDigits((d) => d.map((x, j) => (j === i ? "" : x)));
    setDigits((d) => {   // from the latest boxes, not the render's: quick typing sends several keys before a render
      const next = [...d];
      only.slice(0, 6 - i).split("").forEach((c, k) => { next[i + k] = c; });   // a paste or the phone's autofill fills the boxes after this one too
      return next;
    });
    boxes.current[Math.min(i + only.length, 5)]?.focus();
  }

  const frame = (inner: React.ReactNode) => welcome ? (
    <main className="ui-welcome">
      <header>
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-welcome-kicker">Hot meals from our kitchen · cash at the door</p>
      </header>
      <section className="ui-slip" aria-label="Welcome"><div className="ui-slip-body">
        <div className="ui-slip-head"><span>Welcome</span><span>Step 1 of 3</span></div>
        {inner}
      </div></section>
      <p className="ui-welcome-foot">No app to install · no card needed</p>
    </main>
  ) : (
    <div className="ui-sheet-back">
      <div role="dialog" aria-modal="true" aria-label="Confirm your number" className="ui-sheet">{inner}</div>
    </div>
  );
  const head = (text: string) => (welcome ? <h2 className="ui-welcome-title">{text}</h2> : <div className="ui-sheet-head"><h2>{text}</h2></div>);

  return frame(
    <>
        {step === "number" ? (
          <>
            {head(welcome ? "Where do we reach you?" : "Your mobile number")}
            {welcome && <p className="ui-meta">Your mobile number, then a 6 digit code. The rider calls this number.</p>}
            <div className="ui-field">
              <label htmlFor="otp-phone">Mobile number</label>
              <div className="otp-phone"><span aria-hidden="true">+91</span>
                <input id="otp-phone" className="mono-input" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setError(null); }} /></div>
            </div>
            {error && <p role="alert" className="ui-field-error">{error.message}</p>}
            <button type="button" className={welcome ? "ui-btn big" : "ui-btn bar"} disabled={!isMobile(phone) || busy || locked} onClick={() => send()}>Send code</button>
            {welcome ? (
              <>
                <div className="ui-or" aria-hidden="true"><span /><span>or</span><span /></div>
                <SignIn mode="signin" />
              </>
            ) : <button type="button" className="ui-btn ghost" onClick={onClose}>Not now</button>}
          </>
        ) : (
          <>
            {head("Enter the 6 digit code")}
            <p className="ui-meta">Sent to {showPhone(phone)}{" "}
              <button type="button" className="ui-link" onClick={() => { setStep("number"); setMode("link"); setError(null); setPhone(""); }}>Change number</button></p>
            <div className="otp-boxes">
              {digits.map((d, i) => (
                <input key={i} ref={(el) => { boxes.current[i] = el; }} aria-label={`Digit ${i + 1}`} className="mono-input" type="text" inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"} value={d} disabled={busy}
                  onChange={(e) => typeAt(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus(); }} />
              ))}
            </div>
            {error && <p role="alert" className="ui-field-error">{error.message}</p>}
            {error?.error === "phone_in_use" && (
              <div className="otp-choices">
                <button type="button" className="ui-btn" onClick={signInInstead}>Sign in with this number</button>
                <button type="button" className="ui-btn ghost" onClick={() => { setStep("number"); setError(null); setPhone(""); }}>Use another number</button>
              </div>
            )}
            <button type="button" className={welcome ? "ui-btn big" : "ui-btn bar"} disabled={code.length !== 6 || busy} onClick={verify}>Verify</button>
            {wait > 0 ? <p role="timer" className="ui-meta">Resend code in 0:{String(wait).padStart(2, "0")}</p>
              : <button type="button" className="ui-btn ghost" disabled={busy || locked} onClick={() => send()}>Resend code</button>}
          </>
        )}
    </>
  );
}

// O9: asked once, after the first sign in. Skippable.
export function NameSheet({ onDone }: { onDone: (name: string | null) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="ui-sheet-back">
      <div role="dialog" aria-modal="true" aria-label="Your name" className="ui-sheet">
        <div className="ui-sheet-head"><h2>What should we call you?</h2></div>
        <div className="ui-field"><label htmlFor="otp-name">Your name</label><input id="otp-name" type="text" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <button type="button" className="ui-btn bar" disabled={!name.trim()} onClick={() => onDone(name.trim())}>Continue</button>
        <button type="button" className="ui-btn ghost" onClick={() => onDone(null)}>Skip</button>
      </div>
    </div>
  );
}
