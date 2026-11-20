// "You" of the Ink v3 board 09 (story H10d, #193; story D2): the details this phone remembers, order alerts, Day and Night, another phone, forget me, feedback.
import { useEffect, useRef, useState } from "react";
import { useBackCloses } from "../lib/back";
import { DEFAULT_THEME, readPin, pinTheme, type Theme } from "../lib/theme";
import { buildLabel } from "../lib/updates";
import { useSheetFit } from "../ui";
import { SignIn } from "./SignIn";
import { PlaceRow } from "./BillScreen";

type Props = {
  name: string; phone: string; address: string; farKm: number | null; pin: string | null; photo: string | null; email: string | null;
  onName: (v: string) => void; onPhone: (v: string) => void;
  alerts: "ask" | "on" | "off" | "none"; onAlerts: () => void; alertsError?: string | null;
  live: { label: string; no: string; onOpen: () => void } | null;
  onGivenName: (name: string) => void;   // story 527: the Google first name fills an empty name
  onForget: () => void;
  onDeleteAccount: () => Promise<string | null>;   // story #771: deletes the account on the server; the answer is a message when it was refused, null when it worked
  onMenu: () => void; onAddresses: () => void; onOrders: () => void;   // story #1118: the Saved addresses and Your orders rows
};

const store = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

export function AccountScreen({ name, phone, address, farKm, pin, photo, email, onName, onPhone, alerts, onAlerts, alertsError, live, onGivenName, onForget, onDeleteAccount, onMenu, onAddresses, onOrders }: Props) {
  const sheetRef = useSheetFit();   // story #975: the profile sheet follows the visual viewport too
  const [photoBad, setPhotoBad] = useState(false);
  const fit = useSheetFit();   // story #954: the overlay follows the visual viewport
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name, phone });   // story 640: Edit opens a draft; Save applies it, Cancel drops it
  const [look, setLook] = useState<Theme>(() => readPin(store()) ?? DEFAULT_THEME);
  const [signingOut, setSigningOut] = useState(false);   // story 1593: Sign out of this phone asks in a sheet
  const [deleting, setDeleting] = useState<null | { busy: boolean; error: string | null }>(null);   // story #771: the confirm sheet
  useBackCloses(deleting !== null, () => setDeleting(null));   // story 1415: Back keeps the account
  useBackCloses(signingOut, () => setSigningOut(false));   // Back stays signed in
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!signingOut) return;
    stay.current?.focus();   // the safe answer has the focus
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setSigningOut(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [signingOut]);
  const pick = (t: Theme) => { pinTheme(store(), document, t === DEFAULT_THEME ? null : t); setLook(t); };   // Day is the default, not a pin (#225)
  const row = (label: string, value: string, mono = false) => (<><dt className="mono">{label}</dt><dd className={mono ? "mono" : undefined}>{value || "Not saved yet"}</dd></>);
  const arrow = <span className="go" aria-hidden="true">›</span>;
  return (
    <>
    <section ref={sheetRef} className="ui-you-page" role="dialog" aria-modal="true" aria-label="You">   {/* story #1118 (board Y4b): a full page, not a sheet */}
      <header className="ui-you-top">
        <button type="button" className="ui-pinmap-back" aria-label="Back" onClick={onMenu}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        </button>
        <h1>You</h1>
      </header>
      {live && <button type="button" className="ui-live" onClick={live.onOpen}><span className="tag">{live.label}</span><span className="mono">No. {live.no}</span><span className="go" aria-hidden="true">›</span></button>}
      <div className="ui-account">
        <section className="ui-you-card lime ph-no-capture" aria-label="Delivery details" data-testid="account">
          <div className="ui-profile-head">
            <span className="ui-profile-photo" aria-hidden="true">{photo && !photoBad ? <img src={photo} alt="" width={48} height={48} referrerPolicy="no-referrer" onError={() => setPhotoBad(true)} /> : name.trim().charAt(0).toUpperCase() || "·"}</span>
            <div className="ui-profile-who"><h2>{name.trim() || "You"}</h2><span className="mono">{[phone, email].filter(Boolean).join(" · ") || "No details saved yet"}</span></div>
            {!editing && <button type="button" className="ui-link" aria-label="Edit delivery details" onClick={() => { setDraft({ name, phone }); setEditing(true); }}>Edit</button>}
          </div>
          {editing && (
            <div className="ui-form ui-form-flush">
              <div className="ui-field"><label htmlFor="acc-name">Your name</label><input id="acc-name" type="text" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="ui-field"><label htmlFor="acc-phone">Phone</label><input id="acc-phone" className="mono-input" type="tel" inputMode="numeric" maxLength={10} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, "") })} /></div>
            </div>
          )}
          <PlaceRow words={address} onChange={onAddresses} farKm={farKm} />   {/* story 1532: the place's words; Change opens Deliver to */}
        </section>
        <div className="ui-google"><SignIn returnTo="account" onGivenName={onGivenName} /></div>
        <div className="ui-you-card">
          <button type="button" className="ui-row" onClick={onAddresses}><span>Saved addresses</span>{arrow}</button>
          <button type="button" className="ui-row" onClick={onOrders}><span>Your orders</span>{arrow}</button>
        </div>
        <div className="ui-you-card">
          <div className="ui-row ui-row-static">
            <label htmlFor="alerts" className="ui-row-label"><span>Order alerts</span><span className="ui-row-sub">{alerts === "none" ? "Blocked in your phone settings. Settings › Notifications › GoServe, then come back." : alerts === "on" ? "On for this phone" : alerts === "off" ? "Off for this phone" : ""}</span></label>
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
        </div>
        <div className="ui-you-card">
          <button type="button" className="ui-row" onClick={() => { onMenu(); window.dispatchEvent(new Event("gs-feedback")); }}><span className="ui-row-label"><span>Send feedback</span><span className="ui-row-sub">Two lines and a screenshot. We read every note.</span></span>{arrow}</button>
        </div>
        <div className="ui-you-card risky">
          <button type="button" className="ui-row" onClick={() => setSigningOut(true)}><span>Sign out of this phone</span></button>
          <button type="button" className="ui-row" onClick={() => setDeleting({ busy: false, error: null })}><span>Delete my account</span></button>
        </div>
        <p className="mono ui-legal"><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p>
        <p className="mono ui-legal">{buildLabel(import.meta.env.VITE_BUILD)}</p>
      </div>
      {editing && (   /* story 1693: the answers sit in a bar at the bottom of the page, Cancel left and Save last, right */
        <div className="ui-edit-bar">
          <div className="ui-row-pair">
            <button type="button" className="ui-btn ghost big" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="ui-btn big" onClick={() => { onName(draft.name); onPhone(draft.phone); setEditing(false); }}>Save</button>
          </div>
        </div>
      )}
    </section>
      {signingOut && (
        <div ref={fit} className="ui-sheet-back" onClick={() => setSigningOut(false)}>
          <div role="dialog" aria-modal="true" aria-label="Sign out of this phone?" className="ui-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ui-sheet-head"><h2>Sign out of this phone?</h2></div>
            <p>This phone forgets your details. Your orders stay in your account.</p>
            <div className="ui-sheet-acts">
              <div className="ui-row-pair">
                <button ref={stay} type="button" className="ui-btn ghost big" onClick={() => setSigningOut(false)}>Stay signed in</button>
                <button type="button" className="ui-btn big" onClick={onForget}>Sign out</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleting && (
        <div ref={fit} className="ui-sheet-back">
          <div role="dialog" aria-modal="true" aria-label="Delete your account?" className="ui-sheet">
            <div className="ui-sheet-head"><h2>Delete your account?</h2></div>
            <p>Your orders, saved details and Google link are deleted. This cannot be undone.</p>
            {deleting.error && <p role="alert" className="ui-field-error">{deleting.error}</p>}
            <div className="ui-sheet-acts">   {/* story 1705: the same pair as the sign-out sheet: equal halves, 56 px, red Delete left, Keep it last on the right */}
              <div className="ui-row-pair">
                <button type="button" className="ui-btn danger big" disabled={deleting.busy} onClick={async () => { setDeleting({ busy: true, error: null }); const err = await onDeleteAccount(); if (err) setDeleting({ busy: false, error: err }); }}>{deleting.busy ? "Deleting…" : "Delete"}</button>
                <button type="button" className="ui-btn ghost big" disabled={deleting.busy} onClick={() => setDeleting(null)}>Keep it</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
