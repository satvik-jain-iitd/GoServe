// "You" of the Ink v3 board 09 (story H10d, #193; story D2): the details this phone remembers, order alerts, Day and Night, another phone, forget me, feedback.
import { useState } from "react";
import { DEFAULT_THEME, readPin, pinTheme, type Theme } from "../lib/theme";
import { buildLabel } from "../lib/updates";
import { TabBar } from "../ui";
import { SignIn } from "./SignIn";

type Props = {
  name: string; phone: string; address: string; pin: string | null;
  onName: (v: string) => void; onPhone: (v: string) => void; onAddress: (v: string) => void;
  alerts: "ask" | "on" | "off" | "none"; onAlerts: () => void; alertsError?: string | null;
  live: { label: string; no: string; onOpen: () => void } | null;
  onGivenName: (name: string) => void;   // story 527: the Google first name fills an empty name
  onForget: () => void;
  onDeleteAccount: () => Promise<string | null>;   // story #771: deletes the account on the server; the answer is a message when it was refused, null when it worked
  onMenu: () => void; onOrders: () => void;
};

const store = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

export function AccountScreen({ name, phone, address, pin, onName, onPhone, onAddress, alerts, onAlerts, alertsError, live, onGivenName, onForget, onDeleteAccount, onMenu, onOrders }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name, phone, address });   // story 640: Edit opens a draft; Save applies it, Cancel drops it
  const [look, setLook] = useState<Theme>(() => readPin(store()) ?? DEFAULT_THEME);
  const [sure, setSure] = useState(false);
  const [deleting, setDeleting] = useState<null | { busy: boolean; error: string | null }>(null);   // story #771: the confirm sheet
  const pick = (t: Theme) => { pinTheme(store(), document, t === DEFAULT_THEME ? null : t); setLook(t); };   // Day is the default, not a pin (#225)
  const row = (label: string, value: string, mono = false) => (<><dt className="mono">{label}</dt><dd className={mono ? "mono" : undefined}>{value || "Not saved yet"}</dd></>);
  return (
    <>
      <header className="ui-head">
        <h1>You</h1>
      </header>
      {live && <button type="button" className="ui-live" onClick={live.onOpen}><span className="tag">{live.label}</span><span className="mono">No. {live.no}</span><span className="go" aria-hidden="true">›</span></button>}
      <div className="ui-scroll ui-account">
        <section className="ui-slip ph-no-capture" aria-label="Delivery details">
          <div className="ui-slip-body">
            <div className="ui-slip-head"><span>Delivery details</span><span>Used on your bill</span></div>
            {editing ? (
              <div className="ui-form ui-form-flush">
                <div className="ui-field"><label htmlFor="acc-name">Your name</label><input id="acc-name" type="text" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div className="ui-field"><label htmlFor="acc-phone">Phone</label><input id="acc-phone" className="mono-input" type="tel" inputMode="numeric" maxLength={10} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, "") })} /></div>
                <div className="ui-field"><label htmlFor="acc-address">Address</label><textarea id="acc-address" rows={2} maxLength={300} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
                <div className="ui-edit-actions"><button type="button" className="ui-btn small" onClick={() => { onName(draft.name); onPhone(draft.phone); onAddress(draft.address); setEditing(false); }}>Save</button><button type="button" className="ui-btn ghost small" onClick={() => setEditing(false)}>Cancel</button></div>
              </div>
            ) : (
              <dl className="ui-dl" data-testid="account">
                {row("Name", name)}{row("Phone", phone, true)}{row("Address", address)}{row("Pin", pin ?? "", true)}
              </dl>
            )}
          </div>
        </section>
        <div className="ui-google"><SignIn returnTo="account" onGivenName={onGivenName} help="Keeps your orders on every phone." /></div>
        {!editing && <button type="button" className="ui-row" onClick={() => { setDraft({ name, phone, address }); setEditing(true); }}><span>Edit delivery details</span><span className="go" aria-hidden="true">›</span></button>}
        <div className="ui-row ui-row-static">
          <label htmlFor="alerts" className="ui-row-label"><span>Order alerts</span><span className="ui-row-sub">{alerts === "none" ? "Blocked in your phone settings. Settings › Notifications › GoServe, then come back." : alerts === "on" ? "On for this phone" : alerts === "off" ? "Off for this phone. Tap to turn on." : "Tap to turn on"}</span></label>
          <input id="alerts" className="ui-switch" type="checkbox" role="switch" checked={alerts === "on"} disabled={alerts === "none"} onChange={onAlerts} />
        </div>
        {alertsError && <p role="alert" className="ui-field-error">{alertsError}</p>}
        <section aria-label="Look" className="ui-look">
          <h2 className="mono">Look</h2>
          <div className="ui-chips">
            <button type="button" className={look === "day" ? "ui-chip on" : "ui-chip"} aria-pressed={look === "day"} onClick={() => pick("day")}>Day</button>
            <button type="button" className={look === "night" ? "ui-chip on" : "ui-chip"} aria-pressed={look === "night"} onClick={() => pick("night")}>Night</button>
          </div>
        </section>
        <button type="button" className="ui-row" onClick={() => window.dispatchEvent(new Event("gs-feedback"))}><span className="ui-row-label"><span>Send feedback</span><span className="ui-row-sub">Two lines and a screenshot. We read every note.</span></span><span className="go" aria-hidden="true">›</span></button>
        {sure ? (
          <div className="ui-row ui-row-static"><span>Forget your details on this phone?</span><span className="ui-ask-act"><button type="button" className="ui-btn" onClick={onForget}>Yes, forget</button><button type="button" className="ui-btn ghost" onClick={() => setSure(false)}>No</button></span></div>
        ) : (
          <button type="button" className="ui-row" onClick={() => setSure(true)}><span>Forget me on this phone</span><span className="go" aria-hidden="true">›</span></button>
        )}
        <button type="button" className="ui-row" onClick={() => setDeleting({ busy: false, error: null })}><span>Delete my account</span><span className="go" aria-hidden="true">›</span></button>
        <p className="mono ui-legal"><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p>
        <p className="mono ui-legal">{buildLabel(import.meta.env.VITE_BUILD)}</p>
      </div>
      {deleting && (
        <div className="ui-sheet-back">
          <div role="dialog" aria-modal="true" aria-label="Delete your account?" className="ui-sheet">
            <div className="ui-sheet-head"><h2>Delete your account?</h2></div>
            <p>Your orders, saved details and Google link are deleted. This cannot be undone.</p>
            {deleting.error && <p role="alert" className="ui-field-error">{deleting.error}</p>}
            <div className="ui-edit-actions">
              <button type="button" className="ui-btn danger" disabled={deleting.busy} onClick={async () => { setDeleting({ busy: true, error: null }); const err = await onDeleteAccount(); if (err) setDeleting({ busy: false, error: err }); }}>{deleting.busy ? "Deleting…" : "Delete"}</button>
              <button type="button" className="ui-btn ghost" disabled={deleting.busy} onClick={() => setDeleting(null)}>Keep it</button>
            </div>
          </div>
        </div>
      )}
      <TabBar current="you" onMenu={onMenu} onOrders={onOrders} onYou={() => undefined} />
    </>
  );
}
