// The day's numbers on the Ink v3 board A8 (story H12, #195; story A4): tiles, then one row per kitchen. Shown on the admin Numbers tab and at the top of the Ops app.
import { useEffect, useRef, useState } from "react";
import { dayNumbers, sumNumbers, type DayNumbers, type KitchenRow } from "../lib/admin";
import { formatRupees } from "../lib/money";
import { Skeleton } from "../ui";
import { getClient } from "../lib/supabase";
import { readOtpSwitchAdmin, saveOtpSwitch } from "../lib/otpSwitch";
import { readHandoverSwitches, saveHandoverSwitch, type HandoverWhich } from "../lib/handoverSwitch";
import { qrAddress, readPayMethodsAdmin, readQrAdmin, setPayMethod, uploadQr, type PayMethodsAdmin, type QrAdmin } from "../lib/payMethods";
import type { DoorMethod } from "../lib/doorMethods";
import { amountProblem, readEarlyFriend, saveEarlyFriend, type EarlyFriendSetting } from "../lib/earlyFriend";
import { MAX_DAYS, MIN_DAYS, readPastDaysAdmin, savePastDays, type PastDaysSetting } from "../lib/pastDays";
import { MAX_RUPEES as INC_MAX, MIN_RUPEES as INC_MIN, STEP_RUPEES, readIncentive, saveIncentive, type IncentiveSetting } from "../lib/incentive";
import { readSupportPhoneAdmin, saveSupportPhone, showPhone, supportPhoneProblem, type SupportPhoneSetting } from "../lib/supportPhone";
import { MAX_FEE_RUPEES, feeProblem, readFeeSetting, saveFeeSetting, type FeeSetting } from "../lib/feeSetting";
import { readSwapSetting, saveSwapSetting, swapPctProblem, type SwapSetting } from "../lib/swapSetting";

// Board A9: the admin-only Settings row for the sold-out swap discount.
export function SwapSettings() {
  const [now, setNow] = useState<SwapSetting | null>(null);
  const [text, setText] = useState("");
  const [line, setLine] = useState<string | null>(null);
  const saved = useRef(false);   // a Save beats a slower first read: the read never puts the old percent back
  useEffect(() => { readSwapSetting(getClient()).then((s) => { if (saved.current) return; setNow(s); setText((typed) => (typed === "" ? String(s.pct) : typed)); }, () => { if (!saved.current) setLine("Could not load the setting. Try again."); }); }, []);
  const [fee, setFee] = useState<FeeSetting | null>(null);   // story 1756: the delivery fee row, first in Settings
  const [feeText, setFeeText] = useState("");
  const [feeLine, setFeeLine] = useState<string | null>(null);
  const feeSaved = useRef(false);
  useEffect(() => { readFeeSetting(getClient()).then((f) => { if (feeSaved.current) return; setFee(f); setFeeText((typed) => (typed === "" ? String(f.amount_paise / 100) : typed)); }, () => { if (!feeSaved.current) setFeeLine("Could not load the setting. Try again."); }); }, []);
  async function saveFee() {
    const problem = feeProblem(feeText);
    if (problem) return void setFeeLine(problem);
    const failed = await saveFeeSetting(getClient(), Number(feeText));
    setFeeLine(failed);
    if (failed) { if (fee) setFeeText(String(fee.amount_paise / 100)); return; }   // the field goes back to the saved value
    if (!fee || fee.amount_paise !== Number(feeText) * 100) { feeSaved.current = true; setFee({ amount_paise: Number(feeText) * 100, updated_by: "you", updated_at: new Date().toISOString() }); }
  }
  async function save() {
    const problem = swapPctProblem(text);
    if (problem) return void setLine(problem);
    const failed = await saveSwapSetting(getClient(), Number(text));
    setLine(failed);
    if (!failed) { saved.current = true; setNow({ pct: Number(text), updated_by: "you", updated_at: new Date().toISOString() }); }
  }
  return (
    <section className="ui-group" aria-label="Settings">
      <h2>Settings</h2>
      <div className="ui-row ui-row-static">
        <span className="ui-row-label"><b>Delivery fee</b><span className="ui-row-sub mono">Rupees on every order · 0 to {MAX_FEE_RUPEES}</span></span>
        <span className="ui-inline">
          <span className="mono">₹</span>
          <input type="number" min={0} max={MAX_FEE_RUPEES} step={1} value={feeText} aria-label="Delivery fee, rupees" className="mono ui-pct" onChange={(e) => { setFeeText(e.target.value); setFeeLine(null); }} />
          <button type="button" className="ui-btn" aria-label="Save delivery fee" onClick={() => void saveFee()}>Save</button>
        </span>
      </div>
      {fee && <p className="mono ui-foot">Now {formatRupees(fee.amount_paise)} · set by {fee.updated_by ?? "the system"}, {new Date(fee.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</p>}
      {feeLine && <p role="alert" className="ui-note error">{feeLine}</p>}
      <div className="ui-row ui-row-static">
        <span className="ui-row-label"><b>Sold-out swap discount</b><span className="ui-row-sub mono">% off the new item, paid by us · 0 to 50</span></span>
        <span className="ui-inline">
          <input type="number" min={0} max={50} step={1} value={text} aria-label="Sold-out swap discount, percent" className="mono ui-pct" onChange={(e) => { setText(e.target.value); setLine(null); }} />
          <span className="mono">%</span>
          <button type="button" className="ui-btn" onClick={() => void save()}>Save</button>
        </span>
      </div>
      {now && <p className="mono ui-foot">Now {now.pct}% · set by {now.updated_by ?? "the system"}, {new Date(now.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</p>}
      {line && <p role="alert" className="ui-note error">{line}</p>}
    </section>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

// Story #1263, board A10-PayMethods: the ways to pay at the door, and the UPI QR the rider shows. The database keeps one method always on.
export function PaymentSettings() {
  const [now, setNow] = useState<PayMethodsAdmin | null>(null);
  const [qr, setQr] = useState<QrAdmin | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [qrLine, setQrLine] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const load = () => {
    setLoadFailed(false);
    readPayMethodsAdmin(getClient()).then(setNow, () => setLoadFailed(true));
    readQrAdmin(getClient()).then(setQr, () => setLoadFailed(true));
  };
  useEffect(load, []);
  async function flip(method: DoorMethod, on: boolean) {
    if (!now) return;
    setLine(null); setBusy(method);
    const answer = await setPayMethod(getClient(), method, on);
    setBusy(null);
    if ("line" in answer) return void setLine(answer.line);   // the switch was never moved: it shows what the server holds
    setNow({ ...now, methods: answer.methods, updated_by: "you", updated_at: new Date().toISOString() });
  }
  async function pick(file: File | undefined) {
    if (!file) return;
    setQrLine(null); setBusy("qr");
    const failed = await uploadQr(getClient(), file);
    if (failed) { setBusy(null); return void setQrLine(failed); }
    readQrAdmin(getClient()).then(setQr, () => setQrLine("The QR is set, but we could not read it back.")).finally(() => setBusy(null));
  }
  const sw = (id: DoorMethod, label: string, sub?: string) => (
    <div className="ui-row ui-row-static">
      <label htmlFor={`pay-${id}`} className="ui-row-label"><b>{label}</b>{sub && <span className="ui-row-sub">{sub}</span>}</label>
      <input id={`pay-${id}`} className="ui-switch" type="checkbox" role="switch" checked={now?.methods.includes(id) === true} disabled={!now || busy !== null} onChange={(e) => void flip(id, e.target.checked)} />
    </div>
  );
  const off = (label: string) => (   // story #1833: nothing to tap, so no switch and no sub line
    <div className="ui-row ui-row-static ui-row-plain"><span className="ui-row-label"><span>{label}</span></span></div>
  );
  return (
    <section className="ui-group" aria-label="Payment methods">
      <h2>Payment methods</h2>
      {sw("cash", "Cash at the door")}
      {sw("upi_door", "UPI at the door", qr !== null && !qr.object ? "Customers see it once a QR is uploaded." : undefined)}
      <div className="ui-row ui-row-static">
        <span className="ui-row-label"><b>UPI QR</b><span className="ui-row-sub">{qr === null ? "Loading…" : qr.object ? `Your QR · set by ${qr.updated_by ?? "the system"}, ${when(qr.updated_at)}` : "No QR yet. Riders cannot take UPI."}</span></span>
        <label className="ui-btn ghost ui-file-btn" aria-disabled={busy !== null}>
          {busy === "qr" ? "Uploading…" : "Change"}
          <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Change the UPI QR" hidden disabled={busy !== null} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {qr?.object && <img className="ui-qr-thumb" src={qrAddress(qr.object) ?? ""} width={120} height={120} alt="The UPI QR now in use" />}
      {qrLine && <p role="alert" className="ui-note error">{qrLine}</p>}
      {line && <p role="alert" className="ui-note error">{line}</p>}
      <h3 className="mono ui-foot ui-left">Not set up yet</h3>
      {off("UPI online")}
      {off("Card online")}
      {now && <p className="mono ui-foot ui-left">Last changed by {now.updated_by ?? "the system"}, {when(now.updated_at)}</p>}
      {loadFailed && <p role="alert" className="ui-note error">Could not load the payment settings. <button type="button" className="ui-btn ghost" onClick={load}>Try again</button></p>}
    </section>
  );
}

// Story #1329, board A14-EarlyFriend: the early-friend offer, on or off, and its amount. Off is the default; promises already given are dropped.
export function EarlyFriendSettings() {
  const [now, setNow] = useState<EarlyFriendSetting | null>(null);
  const [text, setText] = useState("");
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { readEarlyFriend(getClient()).then((s) => { setNow(s); setText(String(s.amount_paise / 100)); }, () => setLine("Could not load the setting. Try again.")); }, []);
  async function save(on: boolean, amountText: string) {
    const amount = !on && now?.on && now ? String(now.amount_paise / 100) : amountText;   // turning off never waits on the amount box: the switch always works
    const problem = amountProblem(amount);
    if (problem) return void setLine(problem);
    setLine(null); setBusy(true);
    const failed = await saveEarlyFriend(getClient(), on, Number(amount));
    setBusy(false);
    if (failed) return void setLine(failed);   // nothing moved: the switch and the amount show what the server holds
    setNow({ on, amount_paise: Number(amount) * 100, updated_by: "you", updated_at: new Date().toISOString() });
  }
  return (
    <section className="ui-group" aria-label="Early friend offer">
      <h2>Early friend offer</h2>
      <div className="ui-row ui-row-static">
        <label htmlFor="early-on" className="ui-row-label"><b>Give the early friend offer</b><span className="ui-row-sub">Off: the normal menu price. Promises already given are dropped.</span></label>
        <input id="early-on" className="ui-switch" type="checkbox" role="switch" checked={now?.on === true} disabled={!now || busy} onChange={(e) => void save(e.target.checked, text)} />
      </div>
      <div className="ui-row ui-row-static">
        <span className="ui-row-label"><b>Amount off the first order</b><span className="ui-row-sub mono">Rupees · 10 to 500</span></span>
        <span className="ui-inline">
          <span className="mono">₹</span>
          <input type="number" min={10} max={500} step={1} value={text} aria-label="Early friend amount, rupees" className="mono ui-pct" disabled={!now} onChange={(e) => { setText(e.target.value); setLine(null); }} />
          <button type="button" className="ui-btn" disabled={!now || busy} onClick={() => void save(now?.on === true, text)}>Set amount</button>
        </span>
      </div>
      {now && <p className="mono ui-foot">Now {now.on ? `on, ₹${now.amount_paise / 100}` : "off"} · set by {now.updated_by ?? "the system"}, {when(now.updated_at)}</p>}
      {line && <p role="alert" className="ui-note error">{line}</p>}
    </section>
  );
}

// Stories 1438 and 1443, board AR1: the block "Rider app". Built rows only: the incentive switch and, while it is on, the amount for each delivery.
// Each change is saved at once as a new version (who and when), so a past delivery keeps the amount of its own moment. Prod starts off.
export function RiderAppSettings() {
  const [now, setNow] = useState<IncentiveSetting | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { readIncentive(getClient()).then(setNow, () => setLine("Could not load the setting. Try again.")); }, []);
  async function save(on: boolean, rupees: number) {
    setLine(null); setBusy(true);
    const failed = await saveIncentive(getClient(), on, rupees);
    setBusy(false);
    if (failed) return void setLine(failed);   // nothing moved: the switch and the amount show what the server holds
    setNow({ on, amount_paise: rupees * 100, updated_by: "you", updated_at: new Date().toISOString() });
  }
  const rupees = now ? now.amount_paise / 100 : 0;
  const [days, setDays] = useState<PastDaysSetting | null>(null);   // story 1442, board AR1: "Past days on Today", 0 to 30; 0 hides the rider's Pichhle din row
  useEffect(() => { readPastDaysAdmin(getClient()).then(setDays, () => setLine("Could not load the setting. Try again.")); }, []);
  async function saveDays(n: number) {
    setLine(null); setBusy(true);
    const failed = await savePastDays(getClient(), n);
    setBusy(false);
    if (failed) return void setLine(failed);
    setDays({ days: n, updated_by: "you", updated_at: new Date().toISOString() });
  }
  const last = [now, days].filter((x) => x !== null).sort((x, y) => y.updated_at.localeCompare(x.updated_at))[0];   // the newer change of the block (both stamps are ISO, so text order is time order)
  return (
    <section className="ui-group" aria-label="Rider app">
      <h2>Rider app</h2>
      {days && (
        <div className="ui-row ui-row-static ui-row-tall">
          <span className="ui-row-label"><b>Past days on Today</b><span className="ui-row-sub mono">0 means today only</span></span>
          <span className="ui-stepper">
            <button type="button" className="ui-btn ghost" aria-label="Fewer past days" disabled={busy || days.days <= MIN_DAYS} onClick={() => void saveDays(days.days - 1)}>−</button>
            <b className="mono" data-testid="past-days">{days.days}</b>
            <button type="button" className="ui-btn ghost" aria-label="More past days" disabled={busy || days.days >= MAX_DAYS} onClick={() => void saveDays(days.days + 1)}>+</button>
          </span>
        </div>
      )}
      <div className="ui-row ui-row-static ui-row-tall">
        <label htmlFor="incentive-on" className="ui-row-label"><b>Incentive</b><span className="ui-row-sub mono">The rider sees it on Today</span></label>
        <input id="incentive-on" className="ui-switch" type="checkbox" role="switch" checked={now?.on === true} disabled={!now || busy} onChange={(e) => void save(e.target.checked, rupees)} />
      </div>
      {now?.on && (
        <div className="ui-row ui-row-static ui-row-tall">
          <span className="ui-row-label"><b>For each delivery</b><span className="ui-row-sub mono">Paid with the salary</span></span>
          <span className="ui-stepper">
            <button type="button" className="ui-btn ghost" aria-label="Less incentive" disabled={busy || rupees <= INC_MIN} onClick={() => void save(true, rupees - STEP_RUPEES)}>−</button>
            <b className="mono" data-testid="incentive-amount">{formatRupees(now.amount_paise)}</b>
            <button type="button" className="ui-btn ghost" aria-label="More incentive" disabled={busy || rupees >= INC_MAX} onClick={() => void save(true, rupees + STEP_RUPEES)}>+</button>
          </span>
        </div>
      )}
      {last && <p className="mono ui-foot">Last changed by {last.updated_by ?? "the system"}, {when(last.updated_at)}</p>}
      {line && <p role="alert" className="ui-note error">{line}</p>}
    </section>
  );
}

// Story #1659 layer 2: the admin-only support phone customers call. Empty Save clears it.
export function SupportSettings() {
  const [now, setNow] = useState<SupportPhoneSetting | null>(null);
  const [text, setText] = useState("");
  const [line, setLine] = useState<string | null>(null);
  const saved = useRef(false);   // a Save beats a slower first read
  useEffect(() => { readSupportPhoneAdmin(getClient()).then((s) => { if (saved.current) return; setNow(s); setText((typed) => (typed === "" ? (s.phone ? showPhone(s.phone) : "") : typed)); }, () => { if (!saved.current) setLine("Could not load the setting. Try again."); }); }, []);
  async function save() {
    const problem = supportPhoneProblem(text);
    if (problem) return void setLine(problem);
    const failed = await saveSupportPhone(getClient(), text);
    setLine(failed);
    if (!failed) { saved.current = true; const phone = text.replace(/ /g, "") || null; setNow({ phone, updated_by: "you", updated_at: new Date().toISOString() }); }
  }
  return (
    <section className="ui-group" aria-label="Support">
      <h2>Support</h2>
      <div className="ui-form ui-form-flush">
        <div className="ui-field">
          <label htmlFor="support-phone">Support phone</label>
          <input id="support-phone" type="tel" inputMode="numeric" value={text} className="mono-input" onChange={(e) => { setText(e.target.value); setLine(null); }} />
          <p className="ui-note">Customers call this number. 10 digits.</p>
        </div>
        <div className="ui-form-acts"><button type="button" className="ui-btn big" onClick={() => void save()}>Save</button></div>
      </div>
      {now && <p className="mono ui-foot">{now.phone ? `Now ${showPhone(now.phone)} · set by ${now.updated_by ?? "the system"}${now.updated_at ? `, ${when(now.updated_at)}` : ""}` : "Not set yet."}</p>}
      {line && <p role="alert" className="ui-note error">{line}</p>}
    </section>
  );
}

// Story 829: the phone code login switch. Off until an SMS provider is live; flipping it reaches an open customer app in seconds.
export function PhoneCodeSetting() {
  const [on, setOn] = useState<boolean | null>(null);
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => { readOtpSwitchAdmin(getClient()).then((s) => setOn(s.on), () => setLine("Could not load the setting. Try again.")); }, []);
  async function flip(next: boolean) {
    setOn(next);
    const failed = await saveOtpSwitch(getClient(), next);
    setLine(failed);
    if (failed) setOn(!next);
  }
  return (
    <section className="ui-group" aria-label="Login">
      <h2>Login</h2>
      <div className="ui-row ui-row-static">
        <label htmlFor="otp-login" className="ui-row-label"><b>Phone code login</b><span className="ui-row-sub">Needs an SMS provider. Off until one is live.</span></label>
        <input id="otp-login" className="ui-switch" type="checkbox" role="switch" checked={on === true} disabled={on === null} onChange={(e) => void flip(e.target.checked)} />
      </div>
      {line && <p role="alert" className="ui-note error">{line}</p>}
    </section>
  );
}

// Story 1672 (board k8admin): the two hand-over code switches. Each works alone; off means the app works as today.
const HANDOVER_ROWS: { which: HandoverWhich; id: string; title: string; sub: string }[] = [
  { which: "kitchen", id: "handover-kitchen", title: "Kitchen handoff code", sub: "The rider tells the cook a code at pick up. Off: the rider taps Picked up, as today." },
  { which: "customer", id: "handover-customer", title: "Customer handoff code", sub: "The customer tells the rider a code at the door. Off: the rider marks Delivered, as today." },
];
export function HandoverCodesSetting() {
  const [on, setOn] = useState<Record<HandoverWhich, boolean | null>>({ kitchen: null, customer: null });
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => { readHandoverSwitches(getClient()).then((s) => setOn({ kitchen: s.kitchen.on, customer: s.customer.on }), () => setLine("Could not load the setting. Try again.")); }, []);
  async function flip(which: HandoverWhich, next: boolean) {
    setOn((o) => ({ ...o, [which]: next }));
    const failed = await saveHandoverSwitch(getClient(), which, next);
    setLine(failed);
    if (failed) setOn((o) => ({ ...o, [which]: !next }));
  }
  return (
    <section className="ui-group" aria-label="Handover codes">
      <h2>Handover codes</h2>
      {HANDOVER_ROWS.map((r) => (
        <div key={r.which} className="ui-row ui-row-static">
          <label htmlFor={r.id} className="ui-row-label"><b>{r.title}</b><span className="ui-row-sub">{r.sub}</span></label>
          <input id={r.id} className="ui-switch" type="checkbox" role="switch" checked={on[r.which] === true} disabled={on[r.which] === null} onChange={(e) => void flip(r.which, e.target.checked)} />
        </div>
      ))}
      {line && <p role="alert" className="ui-note error">{line}</p>}
    </section>
  );
}

export function AdminNumbers({ live, kitchens, admin }: { live?: number; kitchens?: KitchenRow[]; admin?: boolean }) {
  const [rows, setRows] = useState<DayNumbers[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { dayNumbers(getClient()).then(setRows, () => setError(true)); }, []);
  if (error) return <p role="alert" className="ui-note error">Could not load the numbers. Try again.</p>;
  if (!rows) return <div className="ui-pad"><Skeleton lines={3} /></div>;
  const t = sumNumbers(rows);
  const open = kitchens ? kitchens.filter((k) => k.open && k.active).length : null;
  return (
    <div className="ui-pad">
      <p data-testid="day-total" className="mono ui-foot ui-day-total">Today: {t.orders} orders · {t.delivered} delivered · {t.cancelled} cancelled · cash {formatRupees(t.cash_paise)}</p>
      <div className="ui-stats">
        <div className="ui-stat" data-testid="tile-orders"><span className="ui-stat-k">Orders</span><span className="ui-stat-v mono">{t.orders}</span>{live !== undefined && <span className="ui-stat-s mono">{live} live</span>}</div>
        <div className="ui-stat" data-testid="tile-delivered"><span className="ui-stat-k">Delivered</span><span className="ui-stat-v mono">{t.delivered}</span><span className="ui-stat-s mono">{t.cancelled} cancelled</span></div>
        <div className="ui-stat" data-testid="tile-cash"><span className="ui-stat-k">Cash today</span><span className="ui-stat-v mono">{formatRupees(t.cash_paise)}</span></div>
        {open !== null && <div className="ui-stat" data-testid="tile-kitchens"><span className="ui-stat-k">Kitchens open</span><span className="ui-stat-v mono">{open} of {kitchens!.length}</span></div>}
      </div>
      <section className="ui-group" aria-label="Per kitchen">
        <h2>Per kitchen</h2>
        {rows.map((r) => (
          <div key={r.kitchen_id} className="ui-row ui-row-static">
            <span className="ui-row-label"><span>{r.kitchen_name}</span><span className="ui-row-sub mono">{r.orders} orders · {r.delivered} delivered · {r.cancelled} cancelled</span></span>
            <span className="mono">{formatRupees(Number(r.cash_paise))}</span>
          </div>
        ))}
      </section>
      {!admin && <button type="button" className="ui-row" onClick={() => window.dispatchEvent(new Event("gs-feedback"))}><span>Send feedback</span><span className="go" aria-hidden="true">›</span></button>}
    </div>
  );
}
