// "You" of the Ink v3 board 09 (story H10d, #193; story D2): the details this phone remembers, order alerts, Day and Night, another phone, forget me, feedback.
import { useState } from "react";
import { DEFAULT_THEME, readPin, pinTheme, type Theme } from "../lib/theme";
import { buildLabel } from "../lib/updates";
import { TabBar } from "../ui";
import { SignIn } from "./SignIn";

type Props = {
  name: string; phone: string; address: string; pin: string | null;
  onName: (v: string) => void; onPhone: (v: string) => void; onAddress: (v: string) => void;
  alerts: "ask" | "on" | "none"; onAlerts: () => void;
  live: { label: string; no: string; onOpen: () => void } | null;
  onGivenName: (name: string) => void;   // story 527: the Google first name fills an empty name
  onShare: () => Promise<string | null>; onForget: () => void;
  onMenu: () => void; onOrders: () => void;
};

const store = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

export function AccountScreen({ name, phone, address, pin, onName, onPhone, onAddress, alerts, onAlerts, live, onGivenName, onShare, onForget, onMenu, onOrders }: Props) {
  const [editing, setEditing] = useState(false);
  const [look, setLook] = useState<Theme>(() => readPin(store()) ?? DEFAULT_THEME);
  const [note, setNote] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const pick = (t: Theme) => { pinTheme(store(), document, t === DEFAULT_THEME ? null : t); setLook(t); };   // Day is the default, not a pin (#225)
  const row = (label: string, value: string, mono = false) => (<><dt className="mono">{label}</dt><dd className={mono ? "mono" : undefined}>{value || "Not saved yet"}</dd></>);
  return (
    <>
      <header className="ui-head">
        <h1>You</h1>
        <span className="meta">No account needed</span>
      </header>
      {live && <button type="button" className="ui-live" onClick={live.onOpen}><span className="tag">{live.label}</span><span className="mono">No. {live.no}</span><span className="go" aria-hidden="true">›</span></button>}
      <div className="ui-scroll ui-account">
        <section className="ui-slip" aria-label="Delivery details">
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>Delivery details</span><span>Used on your bill</span></div>
            {editing ? (
              <div className="ui-form ui-form-flush">
                <div className="ui-field"><label htmlFor="acc-name">Your name</label><input id="acc-name" type="text" value={name} maxLength={80} onChange={(e) => onName(e.target.value)} /></div>
                <div className="ui-field"><label htmlFor="acc-phone">Phone</label><input id="acc-phone" className="mono-input" type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => onPhone(e.target.value.replace(/\D/g, ""))} /></div>
                <div className="ui-field"><label htmlFor="acc-address">Address</label><textarea id="acc-address" rows={2} maxLength={300} value={address} onChange={(e) => onAddress(e.target.value)} /></div>
              </div>
            ) : (
              <dl className="ui-dl" data-testid="account">
                {row("Name", name)}{row("Phone", phone, true)}{row("Address", address)}{row("Pin", pin ?? "", true)}
              </dl>
            )}
          </div>
        </section>
        <div className="ui-row ui-row-static"><SignIn onGivenName={onGivenName} /></div>
        <button type="button" className="ui-row" onClick={() => setEditing(!editing)}><span>{editing ? "Done" : "Edit delivery details"}</span><span className="go" aria-hidden="true">›</span></button>
        <div className="ui-row ui-row-static">
          <label htmlFor="alerts" className="ui-row-label"><span>Order alerts</span><span className="ui-row-sub">{alerts === "none" ? "Blocked in your phone settings." : "A ping when it is ready and at your door."}</span></label>
          <input id="alerts" className="ui-switch" type="checkbox" role="switch" checked={alerts === "on"} disabled={alerts !== "ask"} onChange={onAlerts} />
        </div>
        <section aria-label="Look" className="ui-look">
          <h2 className="mono">Look</h2>
          <div className="ui-chips">
            <button type="button" className={look === "day" ? "ui-chip on" : "ui-chip"} aria-pressed={look === "day"} onClick={() => pick("day")}>Day</button>
            <button type="button" className={look === "night" ? "ui-chip on" : "ui-chip"} aria-pressed={look === "night"} onClick={() => pick("night")}>Night</button>
          </div>
        </section>
        <button type="button" className="ui-row" onClick={async () => setNote(await onShare())}><span>Use on another phone</span><span className="go" aria-hidden="true">›</span></button>
        <button type="button" className="ui-row" onClick={() => window.dispatchEvent(new Event("gs-feedback"))}><span>Send feedback</span><span className="go" aria-hidden="true">›</span></button>
        {sure ? (
          <div className="ui-row ui-row-static"><span>Forget your details on this phone?</span><span className="ui-ask-act"><button type="button" className="ui-btn" onClick={onForget}>Yes, forget</button><button type="button" className="ui-btn ghost" onClick={() => setSure(false)}>No</button></span></div>
        ) : (
          <button type="button" className="ui-row" onClick={() => setSure(true)}><span>Forget me on this phone</span><span className="go" aria-hidden="true">›</span></button>
        )}
        {note && <p role="status" className="ui-note">{note}</p>}
        <p className="mono ui-legal"><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p>
        <p className="mono ui-legal">{buildLabel(import.meta.env.VITE_BUILD)}</p>
      </div>
      <TabBar current="you" onMenu={onMenu} onOrders={onOrders} onYou={() => undefined} />
    </>
  );
}
