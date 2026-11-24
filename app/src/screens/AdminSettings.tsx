// Story #1832 (epic #1831): the admin Settings tab. A short list; each row says its state now and opens its own screen (the same controls that used to sit on Numbers).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getClient } from "../lib/supabase";
import { formatRupees } from "../lib/money";
import { readPayMethodsAdmin } from "../lib/payMethods";
import { readEarlyFriend } from "../lib/earlyFriend";
import { readFeeSetting } from "../lib/feeSetting";
import { readSwapSetting } from "../lib/swapSetting";
import { readIncentive } from "../lib/incentive";
import { readPastDaysAdmin } from "../lib/pastDays";
import { readOtpSwitchAdmin } from "../lib/otpSwitch";
import { readHandoverSwitches } from "../lib/handoverSwitch";
import { readSupportPhoneAdmin } from "../lib/supportPhone";
import { AdminDecisions } from "./AdminDecisions";
import { AdminSim } from "./AdminSim";
import { EarlyFriendSettings, HandoverCodesSetting, PaymentSettings, PhoneCodeSetting, RiderAppSettings, SupportSettings, SwapSettings } from "./AdminNumbers";

export type SettingsView = "pay" | "offers" | "fees" | "rider" | "login" | "handover" | "support" | "rules" | "sim";
const ROWS: { key: SettingsView | "feedback"; title: string }[] = [
  { key: "pay", title: "Payment methods" }, { key: "offers", title: "Offers" }, { key: "fees", title: "Fees and discounts" }, { key: "rider", title: "Rider app" },
  { key: "login", title: "Login" }, { key: "handover", title: "Hand-over codes" }, { key: "support", title: "Support" }, { key: "rules", title: "Rider rules" },
  { key: "sim", title: "Simulator" }, { key: "feedback", title: "Send feedback" },
];
export const settingsTitle = (v: SettingsView) => ROWS.find((r) => r.key === v)!.title;
const METHOD: Record<string, string> = { cash: "Cash", upi_door: "UPI at the door" };
let kept = 0;   // the list's scroll, so Back lands at the same place

export function AdminSettings({ onOpen }: { onOpen: (v: SettingsView) => void }) {
  const [st, setSt] = useState<Partial<Record<SettingsView, string>>>({});
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (box.current) box.current.scrollTop = kept; }, []);
  useEffect(() => {
    const c = getClient();
    const put = (k: SettingsView, line: string) => setSt((o) => ({ ...o, [k]: line }));   // a read that fails says nothing
    const ignore = () => undefined;
    readPayMethodsAdmin(c).then((p) => { const n = p.methods.map((m) => METHOD[m]).filter(Boolean); if (n.length) put("pay", `${n.join(" and ")} ${n.length > 1 ? "are" : "is"} on`); }, ignore);
    readEarlyFriend(c).then((e) => put("offers", e.on ? `Early friend offer is on, ${formatRupees(e.amount_paise)} off` : "Early friend offer is off"), ignore);
    Promise.all([readFeeSetting(c), readSwapSetting(c)]).then(([f, s]) => put("fees", `Delivery fee ${formatRupees(f.amount_paise)} · swap discount ${s.pct}%`), ignore);
    Promise.all([readPastDaysAdmin(c), readIncentive(c)]).then(([d, i]) => put("rider", `${d.days} past days · incentive ${i.on ? formatRupees(i.amount_paise) : "off"}`), ignore);
    readOtpSwitchAdmin(c).then((o) => put("login", `Phone code login is ${o.on ? "on" : "off"}`), ignore);
    readHandoverSwitches(c).then((h) => put("handover", `Kitchen ${h.kitchen.on ? "on" : "off"} · customer ${h.customer.on ? "on" : "off"}`), ignore);
    readSupportPhoneAdmin(c).then((s) => put("support", s.phone ? "Support phone is set" : "Support phone is not set"), ignore);
  }, []);
  const sub = (k: string) => (k === "rules" ? "Free rider with the fewest trips" : st[k as SettingsView]);
  return (
    <div className="ui-scroll" ref={box} onScroll={(e) => { kept = e.currentTarget.scrollTop; }}>
      <div className="ui-pad">
        {ROWS.map((r) => (
          <button key={r.key} type="button" className="ui-row" onClick={() => (r.key === "feedback" ? window.dispatchEvent(new Event("gs-feedback")) : onOpen(r.key))}>
            <span className="ui-row-label"><b>{r.title}</b>{sub(r.key) && <span className="ui-row-sub">{sub(r.key)}</span>}</span>
            <span className="go" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsInner({ view }: { view: SettingsView }): ReactNode {
  if (view === "sim") return <div className="ui-scroll"><AdminSim /></div>;
  const body: Record<SettingsView, ReactNode> = {
    pay: <PaymentSettings />, offers: <EarlyFriendSettings />, fees: <SwapSettings />, rider: <RiderAppSettings />, login: <PhoneCodeSetting />,
    handover: <HandoverCodesSetting />, support: <SupportSettings />, rules: <AdminDecisions />, sim: null,
  };
  return <div className="ui-scroll"><div className="ui-pad ui-inner">{body[view]}</div></div>;
}
