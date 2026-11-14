// Shared by the kitchen, rider and tracker specs (stories #49 and #50). Supabase REST, the live socket and the n8n webhook are answered by the test.
// The live socket speaks the Phoenix protocol version 2 (arrays), as supabase-js 2.x does.
import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page } from "@playwright/test";

export const SESSION = "7e57ab1e-0000-4000-8000-0000000000a1";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const JWT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: SESSION, role: "authenticated", is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
export const ID = "0f0f0f0f-1111-4222-8333-444444444444";
export const order = (status: string, updated = "2020-01-01T10:00:00Z", created = "2020-01-01T10:00:00Z") => ({
  id: ID, session_id: SESSION, kitchen_id: "k", client_order_key: "k1", status, address: "Flat 4, Green Park",
  items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 2, price_paise: 32000 }], total_paise: 64000, created_at: created, updated_at: updated,
});

export const decisionOf = (over: object = {}) => ({
  use_case: "D1", rule_pick: "r2", chosen_pick: "r2", chosen_by: "rule", jev_status: "ok", jev: { pick: "r2", confidence: 0.81, agrees: true, ms: 310 }, ...over,
});

type Calls = { place: { headers: Record<string, string>; body: any }[]; riderWrites: { method: string; body: any }[]; customerWrites: { method: string; body: any }[]; menuReads: string[]; menuWrites: { method: string; url: string; body: any }[]; uploads: string[]; uploadMeta: { headers: Record<string, string>; body: Buffer | null }[]; kitchenWrites: { method: string; url: string; body: any }[]; signups: number; status: any[]; decide: any[]; health: any[]; feedback: any[]; confirm: any[]; rpc: { name: string; body: any }[]; orderReads: string[]; staffReads: string[]; riderReads: string[]; sim: { headers: Record<string, string>; body: any }[]; geocode: string[]; places: string[]; serve: string[]; addressWrites: { method: string; body: any }[]; engine: { headers: Record<string, string>; body: any }[] };
// `pin` is the pin code this device already knows (story B2); pass null for a first visit. The test kitchen k-1 serves 110016.
// The shared kitchen is open all day (00:00 to 23:59 India) so that a run at any hour meets an open kitchen (story #321: hours are obeyed). Specs that test the hours set their own clock and hours.
// Story 829: the customer app shows a login wall to a signed-out customer, so a customer on the menu is signed in. `guest: true` is the signed-out one (the wall specs).
export async function setup(context: BrowserContext, page: Page, initial: object[] = [], { pin = "110016" as string | null, guest = false } = {}) {
  if (pin) await context.addInitScript((p) => { try { if (!window.localStorage.getItem("gs-pin")) window.localStorage.setItem("gs-pin", p); } catch { /* blocked */ } }, pin);
  const calls: Calls = { place: [], riderWrites: [], customerWrites: [], menuReads: [], menuWrites: [], uploads: [], uploadMeta: [], kitchenWrites: [], signups: 0, status: [], decide: [], health: [], feedback: [], confirm: [], rpc: [], orderReads: [], staffReads: [], riderReads: [], sim: [], geocode: [], places: [], serve: [], addressWrites: [], engine: [] };
  const state = { areaRequest: { ok: true, offer_paise: 10000 } as { ok?: boolean; message?: string; offer_paise?: number }, events: [] as { order_id: string; event: string }[], arrivingAt: null as string | null, changeReply: { ok: true } as object, incentive: { on: false, amount_paise: 1000, log: [] } as { on: boolean; amount_paise: number; log: object[] }, incentiveFail: false, incentiveSets: [] as { p_on: boolean; p_amount_paise: number }[], eventsDown: false, pastDays: 7, pastDaysFail: false, pastDaysSets: [] as number[], phoneUser: false, clearAllowedDelayMs: 0, simDelayMs: 0, otpLogin: false as boolean | null | "down", swapPct: 10, swapDelayMs: 0, tracking: null as null | { rider_lat?: number | null; rider_lng?: number | null; updated_at: string; eta_lo_min?: number | null; eta_hi_min?: number | null; eta_late?: boolean; rider_at?: string | null; drop_lat?: number | null; drop_lng?: number | null }, pinPoint: { pin: "110016", lat: 28.59, lng: 77.26 } as null | { pin: string; lat: number; lng: number }, openAlert: { ok: true } as object, deleteReply: { ok: true } as object, rpcError: null as null | { name: string; message: string; details?: string }, invites: [] as any[], inviteOnAdd: false, claimGrant: null as null | "kitchen" | "rider" | "admin", userEmail: null as null | string, avatar: null as null | string, geocode: null as null | { status: number; body: object }, places: null as null | { status: number; body: object }, serve: null as null | { status: number; body: object }, addresses: [] as any[], addressNear: 200, clearSlices: 1, clearCalls: 0, clearReply: null as null | object, removeReply: { ok: true } as object, doorMethods: ["cash", "upi_door"] as string[], doorFail: false, early: { on: false, amount_paise: 10000 } as { on: boolean; amount_paise: number }, earlyFail: false, earlySets: [] as { p_on: boolean; p_amount_paise: number }[], payAdmin: ["cash", "upi_door"] as string[], payFail: false, qrObject: null as string | null, qrFail: "" as string, qrSets: [] as string[], doorCalls: 0, doorDelayMs: 0, turnOnReply: { ok: true, changed: true } as object, turnOnStatus: 200, turnOnDelayMs: 0, offLog: [] as object[], confirmCfg: { confirm_after_ready_min: 3, confirm_after_place_min: 8 }, confirmDone: false, confirmAt: null as null | string, feedbackDown: false, orders: initial, reply: null as null | { status: number; body: unknown }, menuUp: true, kitchen: null as null | string, staffOther: null as null | string, otherRider: false, rider: { user_id: SESSION, name: "Rider", online: true, lat: null, lng: null } as null | { online: boolean; [k: string]: unknown }, customer: null as null | object, numbers: [] as object[], admin: false, people: [] as object[], kitchens: [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }] as object[], menu: [{ id: "d1", name: "Butter Chicken", price_paise: 32000, image_url: null, image_credit: null }] as object[], riderCard: null as null | { name: string; phone: string }, anonymous: guest, riders: null as null | object[], ridersFail: false, decisions: [] as object[], runs: [] as object[], runCount: 0, sim: { enabled: false, kitchens: 10, riders: 40, riders_online: 29, dishes: 137, kitchens_real: 6, riders_real: 2, clear_allowed: true, knobs: { reject_pct: 5, sold_out_pct: 3, delay_pct: 10, rider_drop_pct: 2 } as Record<string, number | boolean | undefined> }, engine: { engine: "rules", version: 1, by: "system", changed_at: "2026-10-25T04:00:00Z" }, engineReply: null as null | { status: number; body: unknown } };
  const json = (route: any, status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  await context.route("https://test.supabase.co/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (req.url().includes("/auth/v1/signup")) {
      calls.signups++;
      return json(route, 200, { access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
        user: { id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: state.anonymous, app_metadata: {}, email: state.userEmail ?? undefined, user_metadata: state.anonymous || state.phoneUser ? {} : { full_name: "Amit Kumar" }, created_at: new Date().toISOString() } });
    }
    if (req.url().includes("/rest/v1/rpc/")) {
      const name = req.url().split("/rest/v1/rpc/")[1].split("?")[0];
      calls.rpc.push({ name, body: JSON.parse(req.postData() ?? "{}") });
      if (state.rpcError && state.rpcError.name === name) return json(route, 400, { message: state.rpcError.message, details: state.rpcError.details });   // #466: one database function refuses with this code
      if (name === "decide_rider_rules_v2") {   // story #1068: the database decides; the answer is 200 with ok true or a refusal
        const b = JSON.parse(req.postData() ?? "{}");
        calls.decide.push({ action: "decide", session_id: b.p_session, order_id: b.p_order, riders: b.p_riders });
        const r = state.reply ?? { status: 200, body: { ok: true, decision: decisionOf() } };
        if (r.status === 200) state.decisions = [{ id: 1, order_id: b.p_order, session_id: SESSION, created_at: new Date().toISOString(), decision: decisionOf() }];
        return json(route, 200, r.body);
      }
      if (name === "swap_discount_get_v2") {
        const pct = state.swapPct;   // the server reads the row when the call arrives, so a slow answer can carry the value from before a Save
        if (state.swapDelayMs) await new Promise((r) => setTimeout(r, state.swapDelayMs));   // a slow load
        return json(route, 200, { pct, updated_by: "owner@goserve.test", updated_at: "2026-10-29T14:10:00Z" });   // #619 layer d, board A9
      }
      if (name === "otp_login_get_v2") return json(route, 200, { on: state.otpLogin === true, updated_by: "owner@goserve.test", updated_at: "2026-11-03T10:00:00Z" });   // story 829: the phone code switch
      if (name === "otp_login_set_v2") { state.otpLogin = JSON.parse(req.postData() ?? "{}").p_on === true; return json(route, 200, { ok: true }); }
      if (name === "swap_discount_set_v2") {
        const p = JSON.parse(req.postData() ?? "{}").p_pct;
        if (!Number.isInteger(p) || p < 0 || p > 50) return json(route, 200, { ok: false, error: "invalid_percent", message: "Pick a whole number from 0 to 50." });
        state.swapPct = p;
        return json(route, 200, { ok: true });
      }
      if (name === "rider_past_days") return state.pastDaysFail ? json(route, 500, { code: "XX000", message: "boom" }) : json(route, 200, { days: state.pastDays });   // story 1442: the admin's number, read by the rider
      if (name === "rider_past_days_get_v2") return json(route, 200, { days: state.pastDays, updated_by: "owner@goserve.test", updated_at: "2026-11-14T00:30:00Z" });
      if (name === "rider_past_days_set_v2") { const b = route.request().postDataJSON(); state.pastDaysSets.push(b.p_days); state.pastDays = b.p_days; return json(route, 200, { ok: true }); }
      if (name === "rider_incentive_rates") return json(route, 200, state.incentive);   // stories 1443 and 1438: the switch now and its recent changes
      if (name === "rider_incentive_get_v2") return json(route, 200, { on: state.incentive.on, amount_paise: state.incentive.amount_paise, updated_by: "owner@goserve.test", updated_at: "2026-11-13T09:30:00Z" });
      if (name === "rider_incentive_set_v2") {
        if (state.incentiveFail) return json(route, 500, { code: "XX000", message: "boom" });
        const b = JSON.parse(req.postData() ?? "{}");
        state.incentiveSets.push(b); state.incentive = { ...state.incentive, on: b.p_on, amount_paise: b.p_amount_paise };
        return json(route, 200, { ok: true, changed: true });
      }
      if (name === "rider_change_paid") return json(route, 200, state.changeReply);   // story 1448: the rider puts a wrong cash or UPI tap right
      if (name === "rider_arriving_at") return json(route, 200, state.arrivingAt ?? null);   // story 1182: when Arriving was sent for the rider's order (null: not yet)
      if (name === "delete_my_account") return json(route, 200, state.deleteReply);   // #771: the You screen deletes the account
      if (name === "kitchen_remove_v2") { const r = state.removeReply as { ok?: boolean }; if (r.ok) state.kitchens = (state.kitchens as any[]).map((k) => k.id === JSON.parse(req.postData() ?? "{}").p_kitchen ? { ...k, active: false, open: false } : k); return json(route, 200, r); }   // #900: a removed kitchen is switched off, not deleted
      if (name === "early_friend_get_v2") return json(route, 200, { ...state.early, updated_by: "owner@goserve.test", updated_at: "2026-11-10T10:00:00Z" });   // story #1329, board A11
      if (name === "early_friend_set_v2") {
        if (state.earlyFail) return json(route, 500, { code: "XX000", message: "boom" });
        const b = JSON.parse(req.postData() ?? "{}");
        if (!Number.isInteger(b.p_amount_paise) || b.p_amount_paise < 1000 || b.p_amount_paise > 50000) return json(route, 200, { ok: false, error: "invalid_amount", message: "Pick an amount from Rs 10 to Rs 500." });
        state.earlySets.push(b); state.early = { on: b.p_on, amount_paise: b.p_amount_paise };
        return json(route, 200, { ok: true, changed: true });
      }
      if (name === "payment_methods_get_v2") return state.payFail ? json(route, 500, { code: "XX000", message: "boom" }) : json(route, 200, { methods: state.payAdmin, updated_by: "owner@goserve.test", updated_at: "2026-11-10T09:30:00Z" });   // story #1263, board A10
      if (name === "payment_methods_set_v2") {
        if (state.payFail) return json(route, 500, { code: "XX000", message: "boom" });
        const b = JSON.parse(req.postData() ?? "{}");
        const next = b.p_on ? [...new Set([...state.payAdmin, b.p_method])] : state.payAdmin.filter((m) => m !== b.p_method);
        if (next.length === 0) return json(route, 200, { ok: false, error: "last_method", message: "One way to pay must stay on." });
        if (!next.includes("cash") && !state.qrObject) return json(route, 200, { ok: false, error: "qr_missing", message: "Upload the UPI QR first." });
        state.payAdmin = next; state.doorMethods = next;
        return json(route, 200, { ok: true, changed: true, methods: next });
      }
      if (name === "upi_qr_get_v2") return json(route, 200, { object: state.qrObject, updated_by: "owner@goserve.test", updated_at: "2026-11-10T09:40:00Z" });
      if (name === "upi_qr_set_v2") {
        if (state.qrFail === "set") return json(route, 500, { code: "XX000", message: "boom" });
        const o = JSON.parse(req.postData() ?? "{}").p_object; state.qrSets.push(o); state.qrObject = o;
        return json(route, 200, { ok: true, object: o });
      }
      if (name === "upi_qr_object") return state.qrFail === "read" ? json(route, 500, { code: "XX000", message: "boom" }) : json(route, 200, state.qrObject);
      if (name === "payment_methods_on") { state.doorCalls++; if (state.doorDelayMs) await new Promise((r) => setTimeout(r, state.doorDelayMs)); } if (name === "payment_methods_on") return state.doorFail ? json(route, 500, { code: "XX000", message: "boom" }) : json(route, 200, state.doorMethods);   // story #1261: the ways to pay at the door that are on
      if (name === "kitchen_turn_on") {   // story #1280 (board A13): the admin turns an off kitchen back on; it stays closed for orders
        if (state.turnOnDelayMs) await new Promise((r) => setTimeout(r, state.turnOnDelayMs));
        if (state.turnOnStatus !== 200) return json(route, state.turnOnStatus, { code: "XX000", message: "boom" });
        if ((state.turnOnReply as { ok?: boolean }).ok) state.kitchens = (state.kitchens as any[]).map((k) => k.id === JSON.parse(req.postData() ?? "{}").p_kitchen ? { ...k, active: true, open: false } : k);
        return json(route, 200, state.turnOnReply);
      }
      if (name === "area_request_add_v2") return json(route, 200, state.areaRequest);   // #1049 part 3, board NK-A
      if (name === "open_alert_add_v2") return json(route, 200, state.openAlert);   // #619 layer d, board L1
      if (name === "sim_clear_all") {   // #848: Clear everything is the admin's own database call, never the webhook
        if (state.clearReply) return json(route, 200, state.clearReply);
        // story 873: the function works in slices; the last one says done and carries the city's counts. clearSlices is how many calls the city needs (default 1: only the last).
        if (++state.clearCalls < state.clearSlices) return json(route, 200, { ok: true, done: false, logs_detached: 0, orders: 20, kitchens: 0, riders: 0, dishes: 0 });
        const gone = { ok: true, done: true, logs_detached: 0, orders: state.clearSlices > 1 ? 1 : 41, kitchens: state.sim.kitchens + state.sim.kitchens_real, riders: state.sim.riders + state.sim.riders_real, dishes: state.sim.dishes };
        Object.assign(state.sim, { kitchens: 0, kitchens_real: 0, riders: 0, riders_real: 0, riders_online: 0, dishes: 0 });
        return json(route, 200, gone);
      }
      if (name === "sim_clear_allowed") { if (state.clearAllowedDelayMs) await new Promise((r) => setTimeout(r, state.clearAllowedDelayMs)); return json(route, 200, state.admin && state.sim.clear_allowed); }   // #941: the app asks the database itself, never the webhook
      if (name === "address_near_m") return json(route, 200, state.addressNear);   // story #976: the tunable radius
      if (name === "is_admin") return json(route, 200, state.admin);   // A2: the admin screen asks once
      if (name === "admin_people") return json(route, 200, state.people);
      if (name === "admin_add_person") {   // story 875: an email with no account becomes an invite
        const p = JSON.parse(req.postData() ?? "{}");
        if (state.inviteOnAdd) state.invites.push({ id: `i-${state.invites.length + 1}`, email: String(p.p_email).toLowerCase(), kind: p.p_kind, kitchen_id: p.p_kitchen, kitchen_name: (state.kitchens as any[]).find((k) => k.id === p.p_kitchen)?.name ?? null, created_at: "2026-11-04T10:00:00Z" });
        return json(route, 200, { invited: state.inviteOnAdd });
      }
      if (name === "admin_remove_person") {   // story 880: the person and the rider row go
        const p = JSON.parse(req.postData() ?? "{}");
        state.people = state.people.filter((x: any) => x.user_id !== p.p_user);
        if (state.riders) state.riders = state.riders.filter((x: any) => x.user_id !== p.p_user);
        return route.fulfill({ status: 204, headers: CORS, body: "" });
      }
      if (name === "admin_invites") return json(route, 200, state.invites);
      if (name === "admin_cancel_invite") { state.invites = state.invites.filter((i: any) => i.id !== JSON.parse(req.postData() ?? "{}").p_id); return route.fulfill({ status: 204, headers: CORS, body: "" }); }
      if (name === "claim_my_invites") {   // story 875: the gate's safety check; a granted invite makes the staff or rider row appear
        if (state.claimGrant === "kitchen") state.kitchen = "k-1";
        if (state.claimGrant === "admin") state.admin = true;   // story 968: an admin invite becomes the admins row
        if (state.claimGrant === "rider") state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
        return json(route, 200, state.claimGrant ? 1 : 0);
      }
      if (name === "order_rider") return json(route, 200, state.riderCard ? [state.riderCard] : []);   // D2: the rider card
      return json(route, 200, null);
    }
    if (req.url().includes("/rest/v1/settings")) {   // story 829: the public read of the phone code switch (one row, name = otp_login_on)
      if (state.otpLogin === "down") return json(route, 500, { message: "down" });
      if (state.otpLogin === null) return json(route, 406, { code: "PGRST116", message: "no rows" });
      return json(route, 200, { value: state.otpLogin });
    }
    if (req.url().includes("/rest/v1/riders")) {   // A5: the rider's own row (online, location)
      if (req.method() === "GET") {
        calls.riderReads.push(req.url());
        if (state.ridersFail) return json(route, 500, { message: "down" });   // H12b: an unreadable riders table
        const rows = state.riders ?? [...(state.otherRider ? [{ user_id: "other-rider", name: "Other", online: false }] : []), ...(state.rider ? [state.rider] : [])];   // H12b: an admin's list
        const who = new URL(req.url()).searchParams.get("user_id")?.replace("eq.", "");
        return json(route, 200, rows.filter((r: any) => !who || r.user_id === who));
      }
      const body = JSON.parse(req.postData() ?? "{}");
      calls.riderWrites.push({ method: req.method(), body });
      if (state.rider) Object.assign(state.rider, body);
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    if (req.url().includes("/rest/v1/day_numbers")) return json(route, 200, state.numbers);   // A4: the day's numbers
    if (req.url().includes("/rest/v1/addresses")) {   // story #976: the customer's saved addresses (row level security shows only their own rows)
      const id = new URL(req.url()).searchParams.get("id")?.replace("eq.", "");
      calls.addressWrites.push({ method: req.method(), body: req.postData() ? JSON.parse(req.postData()!) : null });
      if (req.method() === "GET") return json(route, 200, [...state.addresses].sort((a, b) => b.last_used_at.localeCompare(a.last_used_at)));
      if (req.method() === "POST") {
        const row = { id: `a${state.addresses.length + 1}`, lat: null, lng: null, last_used_at: new Date().toISOString(), ...JSON.parse(req.postData() ?? "{}") };
        state.addresses.push(row);
        return json(route, 201, (req.headers().accept ?? "").includes("pgrst.object") ? row : [row]);
      }
      if (req.method() === "PATCH") { state.addresses = state.addresses.map((r) => (r.id === id ? { ...r, ...JSON.parse(req.postData() ?? "{}") } : r)); return route.fulfill({ status: 204, headers: CORS, body: "" }); }
      if (req.method() === "DELETE") { state.addresses = state.addresses.filter((r) => r.id !== id); return route.fulfill({ status: 204, headers: CORS, body: "" }); }
    }
    if (req.url().includes("/rest/v1/customers")) {   // B3: the customer's saved details
      if (req.method() === "GET") return json(route, 200, state.customer ? [state.customer] : []);
      calls.customerWrites.push({ method: req.method(), body: JSON.parse(req.postData() ?? "{}") });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (req.url().includes("/auth/v1/logout")) return route.fulfill({ status: 204, headers: CORS, body: "" });
    if (req.url().includes("/auth/v1/user")) return json(route, 200, { id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: state.anonymous, app_metadata: {}, email: state.userEmail ?? undefined, user_metadata: state.anonymous || state.phoneUser ? {} : { full_name: "Amit Kumar", ...(state.avatar ? { avatar_url: state.avatar } : {}) }, created_at: new Date().toISOString() });   // H11: who is signed in
    if (req.url().includes("/rest/v1/kitchen_active_log")) return json(route, 200, state.offLog);   // story #1280: who turned a kitchen off, and when
    if (req.url().includes("/rest/v1/kitchens")) {   // A2: the admin's kitchen list and writes
      if (req.method() === "GET") return json(route, 200, state.kitchens);
      calls.kitchenWrites.push({ method: req.method(), url: req.url(), body: JSON.parse(req.postData() ?? "{}") });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (req.url().includes("/rest/v1/kitchen_staff")) {   // S-M5: the kitchen this user works for; H3: an admin also sees other people's rows, so the query must filter by user
      calls.staffReads.push(req.url());
      const rows = [...(state.staffOther ? [{ kitchen_id: state.staffOther, user_id: "someone-else" }] : []), ...(state.kitchen ? [{ kitchen_id: state.kitchen, user_id: SESSION }] : [])];
      const who = new URL(req.url()).searchParams.get("user_id")?.replace("eq.", "");
      return json(route, 200, rows.filter((r) => !who || r.user_id === who).map((r) => ({ kitchen_id: r.kitchen_id })));
    }
    if (req.url().includes("/rest/v1/decision_log")) return json(route, 200, state.decisions);
    if (req.url().includes("/rest/v1/run_log")) {
      const total = state.runCount || state.runs.length;
      if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": `*/${total}` } });   // the count query
      const rows = req.url().includes("workflow=like") ? state.runs.filter((r: any) => String(r.workflow).endsWith(": decide")).slice(0, 1) : state.runs;   // the last-decide query
      const limit = Number(new URL(req.url()).searchParams.get("limit") ?? rows.length);   // like PostgREST: only the first rows come back
      return json(route, 200, rows.slice(0, limit));
    }
    if (req.url().includes("/rest/v1/order_events")) {   // like PostgREST: an event filter is honoured (story 1507 reads every event, story 922 only order.arriving)
      if (state.eventsDown) return json(route, 500, { message: "down" });
      const only = new URL(req.url()).searchParams.get("event")?.replace(/^eq\./, "");
      return json(route, 200, only ? (state.events as { event?: string }[]).filter((e) => e.event === only) : state.events);
    }   // #922: the rider's Arriving event, read by the customer's own session
    if (req.url().includes("/rest/v1/order_tracking")) return json(route, 200, state.tracking ? [{ order_id: ID, status: "out_for_delivery", rider_at: state.tracking.updated_at, drop_lat: 28.59, drop_lng: 77.26, ...state.tracking }] : []);   // #691: the rider's place. Story 1497: the row also carries the ping time and the order's drop point (a test that says nothing gets a ping at the row's time and a door at 28.59, 77.26)
    if (req.url().includes("/rest/v1/pin_points")) return json(route, 200, state.pinPoint ? [state.pinPoint] : []);
    if (req.url().includes("/rest/v1/orders")) {
      calls.orderReads.push(req.url());
      return json(route, 200, state.orders);
    }
    if (req.url().includes("/rest/v1/menu_items") && req.method() === "GET") calls.menuReads.push(req.url());
    if (req.url().includes("/rest/v1/menu_items") && req.method() !== "GET") {   // A3: the admin's dish writes
      calls.menuWrites.push({ method: req.method(), url: req.url(), body: JSON.parse(req.postData() ?? "{}") });
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    if (req.url().includes("/rest/v1/menu_items") && !state.menuUp) return json(route, 500, {});
    if (req.url().includes("/rest/v1/menu_items")) return json(route, 200, state.menu);
    return json(route, 404, {});
  });
  await context.route("https://test.supabase.co/storage/v1/object/**", async (route) => {   // A3: photo upload
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (state.qrFail === "upload" && req.url().includes("/upi-qr/")) return json(route, 500, { message: "boom" });
    if (req.method() === "GET" && req.url().includes("/object/public/upi-qr/")) return state.qrFail === "image" ? route.fulfill({ status: 404, headers: CORS, body: "not found" }) : route.fulfill({ status: 200, headers: { ...CORS, "content-type": "image/png" }, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });   // story #1263: the QR picture itself
    calls.uploads.push(req.url());
    calls.uploadMeta.push({ headers: req.headers(), body: req.postDataBuffer() });
    return json(route, 200, { Key: "menu/x" });
  });
  await context.route("https://sim.test/**", async (route) => {   // H7 (#190): GS MAIN 30 Simulator, answered by the test
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    calls.sim.push({ headers: req.headers(), body });
    if (state.simDelayMs) await new Promise((r) => setTimeout(r, state.simDelayMs));
    if (state.reply) return json(route, state.reply.status, state.reply.body);
    const sim = state.sim;
    if (body.action === "seed") { sim.kitchens = 10; sim.riders = body.riders_per_kitchen * 10; sim.riders_online = Math.round(sim.riders * body.online_pct / 100); sim.dishes = 137; return json(route, 200, { ok: true, kitchens: sim.kitchens, kitchens_open: 10, riders: sim.riders, riders_online: sim.riders_online, dishes: sim.dishes }); }
    if (body.action === "seed_kitchens") { sim.kitchens = 10; sim.dishes = 120; return json(route, 200, { ok: true, kitchens: 10, kitchens_open: 10, riders: sim.riders, riders_online: sim.riders_online, dishes: 120 }); }   // #848: the two groups
    if (body.action === "seed_riders") { sim.riders = body.riders_per_kitchen * 10; sim.riders_online = Math.round(sim.riders * body.online_pct / 100); return json(route, 200, { ok: true, kitchens: sim.kitchens, kitchens_open: sim.kitchens, riders: sim.riders, riders_online: sim.riders_online, dishes: sim.dishes }); }
    if (body.action === "knobs") { sim.knobs = typeof body.demo === "boolean" ? { ...sim.knobs, demo: body.demo } : { reject_pct: body.reject_pct, sold_out_pct: body.sold_out_pct, delay_pct: body.delay_pct, rider_drop_pct: body.rider_drop_pct, demo: sim.knobs.demo }; return json(route, 200, { ok: true, knobs: sim.knobs }); }   // #454: demo mode is one more key on the same action
    if (body.action === "reset") { const gone = { ok: true, kitchens: sim.kitchens, riders: sim.riders, dishes: sim.dishes, orders: 0 }; sim.kitchens = 0; sim.riders = 0; sim.riders_online = 0; sim.dishes = 0; return json(route, 200, gone); }
    if (body.action === "enable" || body.action === "disable") { sim.enabled = body.action === "enable"; return json(route, 200, { ok: true, enabled: sim.enabled }); }
    if (body.action === "tick") return json(route, 200, { ok: true, riders_moved: 14, kitchens_flipped: 1, dishes_flipped: 2, riders_flipped: 1, orders: { accepted: 2, cancelled: 1, delivered: 1, dropped: 0 } });
    return json(route, 200, { ok: true, enabled: sim.enabled, kitchens: sim.kitchens, riders: sim.riders, riders_online: sim.riders_online, dishes: sim.dishes, kitchens_real: sim.kitchens_real, riders_real: sim.riders_real, clear_allowed: sim.clear_allowed, knobs: sim.knobs });
  });
  await context.route("https://engine.test/**", async (route) => {   // #263: GS MAIN 32 Decision engine, answered by the test
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    calls.engine.push({ headers: req.headers(), body });
    if (state.engineReply) return json(route, state.engineReply.status, state.engineReply.body);
    if (body.action === "set") state.engine = { engine: body.engine, version: state.engine.version + 1, by: "owner@goserve.test", changed_at: new Date().toISOString() };
    return json(route, 200, { ok: true, ...state.engine });
  });
  // Story #998: the address lookup through our geocode function. Off (503) unless a test gives it an answer.
  await context.route("https://test.supabase.co/functions/v1/geocode**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.geocode.push(req.url());
    const a = state.geocode ?? { status: 503, body: { ok: false, error: "provider_off" } };
    return json(route, a.status, a.body);
  });
  // Story #1036: the Deliver to search, our own place-search function. An empty list unless a test gives it an answer.
  await context.route("https://test.supabase.co/functions/v1/place-search**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.places.push(req.url());
    const a = state.places ?? { status: 200, body: { ok: true, results: [] } };
    return json(route, a.status, a.body);
  });
  // Story #1037: a spec that does not answer OpenStreetMap's reverse lookup never reaches the real server (it answers 500; a spec's own route is registered later and wins).
  await context.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({ status: 500, headers: { ...CORS, "content-type": "application/json" }, body: "{}" }));
  // Story #1037: can a kitchen reach the pin. Served, the kitchen 1.2 km away, unless a test gives another answer.
  await context.route("https://test.supabase.co/functions/v1/serviceability**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.serve.push(req.url());
    const a = state.serve ?? { status: 200, body: { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-1", name: "Hauz Khas Kitchen", distance_m: 1230, eta_min: 30, open: true }] } };
    return json(route, a.status, a.body);
  });
  // Story #940: the customer places with POST /orders and every step after goes to POST /order-actions, both with the signed-in user's token.
  await context.route("https://test.supabase.co/functions/v1/orders", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    calls.place.push({ headers: req.headers(), body });
    const r = state.reply ?? { status: 201, body: { ok: true, created: true, order: { ...order("placed", new Date(Date.now() + 1000).toISOString()), items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 1, price_paise: 32000 }], total_paise: 32000 }, ...state.confirmCfg } };
    return json(route, r.status, r.body);
  });
  await context.route("https://test.supabase.co/functions/v1/order-actions", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    const later = new Date(Date.now() + 1000).toISOString();
    if (body.action === "confirm") {   // story S-C: the customer's Yes
      calls.confirm.push({ headers: req.headers(), body });
      if (state.confirmDone) return json(route, 409, { ok: false, error: "already_done", message: "This step was already done." });
      return json(route, 200, { ok: true, order: { ...order("delivered", state.confirmAt ?? later), paid_by: "cash" } });
    }
    calls.status.push({ headers: req.headers(), body });
    const to: Record<string, string> = { accept: "accepted", prepare: "preparing", ready: "ready", pickup: "out_for_delivery", arriving: "out_for_delivery", deliver: "delivered", cancel: "cancelled" };
    const r = state.reply ?? { status: 200, body: { ok: true, order: { ...order(to[body.action] ?? "placed", later), ...(body.action === "deliver" ? { paid_by: body.method ?? null } : {}) } } };
    return json(route, r.status, r.body);
  });
  await context.route("https://orders.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    if (body.action === "health") {
      calls.health.push({ headers: req.headers(), body });
      const r = state.reply ?? { status: 200, body: { ok: true, jev: { ok: true, status: "ok", ms: 310 } } };
      return json(route, r.status, r.body);
    }
    if (body.action === "feedback") {   // story S-B: a report; when feedbackDown is set the phone cannot reach the server
      if (state.feedbackDown) return route.abort("internetdisconnected");
      calls.feedback.push({ headers: req.headers(), body });
      const r = state.reply ?? { status: 201, body: { ok: true, id: "f1" } };
      return json(route, r.status, r.body);
    }
    return json(route, 404, { ok: false, error: "no_such_action" });   // story #940: place, status, event and confirm no longer exist on the webhook
  });
  // Events pushed before the screen has joined the channel (or just after) wait, like a real event that is sent after the subscription.
  // Story #619: more than one channel can be open (orders, and the kitchen's menu). Each join keeps its own list of what the screen asked to hear.
  const SETTLE_MS = 1500;   // the client needs a moment to bind the join answer; an event sent sooner is dropped
  const sockets: { topic: string; bindings: { event: string; table?: string }[]; send: (m: unknown) => void; joinedAt: number }[] = [];
  const waiting: [string, object, string][] = [];
  const deliver = (type: string, record: object, table: string) => {
    const hits = sockets.filter((c) => Date.now() >= c.joinedAt + SETTLE_MS && c.bindings.some((b) => (b.table ?? "orders") === table));
    for (const c of hits) {
      const idx = c.bindings.findIndex((b) => (b.table ?? "orders") === table && (type === "DELETE" ? b.event === "DELETE" : b.event !== "DELETE"));
      if (idx < 0) continue;
      c.send([null, null, c.topic, "postgres_changes", { ids: [idx + 1],
        data: { schema: "public", table, commit_timestamp: new Date().toISOString(), type, record: type === "DELETE" ? {} : record, old_record: type === "DELETE" ? record : {}, columns: [], errors: null } }]);
    }
    return hits.length > 0;
  };
  const flush = () => { for (const w of waiting.splice(0)) if (!deliver(w[0], w[1], w[2])) waiting.push(w); };
  const push = (type: "INSERT" | "UPDATE" | "DELETE", record: object, table: "orders" | "kitchens" | "menu_items" | "order_tracking" | "order_events" = "orders") => {
    if (!deliver(type, record, table)) { waiting.push([type, record, table]); setTimeout(flush, SETTLE_MS + 50); }
  };
  await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    // One socket carries every channel (supabase-js multiplexes), so each join is kept by its topic.
    const send = (m: unknown) => ws.send(JSON.stringify(m));
    ws.onMessage((raw) => {
      const [join_ref, ref, t, event, payload] = JSON.parse(String(raw));
      if (event === "phx_join") {
        const bindings: { event: string; table?: string }[] = payload?.config?.postgres_changes ?? [];
        const at = sockets.findIndex((c) => c.topic === t);
        const me = { topic: t, bindings, send, joinedAt: Date.now() };
        if (at >= 0) sockets[at] = me; else sockets.push(me);
        ws.send(JSON.stringify([join_ref, ref, t, "phx_reply", { status: "ok", response: { postgres_changes: bindings.map((b, i) => ({ id: i + 1, ...b })) } }]));
        setTimeout(flush, SETTLE_MS + 50);   // a timer may fire a millisecond early: the margin keeps the event from waiting for ever
      } else if (event === "heartbeat") {
        ws.send(JSON.stringify([null, ref, "phoenix", "phx_reply", { status: "ok", response: {} }]));
      }
    });
  });
  return { calls, state, push };
}

/** An axe scan after every CSS animation has finished (the stamp fades in from 0.6, which read as low contrast mid-animation). Returns the serious and critical violations as strings. */
export async function scan(page: Page, tags?: string[]): Promise<string[]> {
  // Finite animations only (the ui-pulse skeleton never finishes), and never more than a second: a scan must not hang on a slow CI.
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 1000))]));
  const b = new AxeBuilder({ page });
  const r = await (tags ? b.withTags(tags) : b).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

// Story #668, #1133: the first question is "Where does the food go?". The form to type it by hand is gone from the journey (the map and its search are the way), so a test that only needs a place
// puts it where the app keeps it (the saved pin and the draft's address) and starts the page again: the same state a picked place leaves.
export async function typePlace(page: import("@playwright/test").Page, pin: string, address = "Flat 4, Green Park") {
  await page.evaluate(([p, a]) => { localStorage.setItem("gs-pin", p); localStorage.setItem("gs-draft", JSON.stringify({ step: "menu", cart: {}, address: a, name: "", phone: "" })); localStorage.setItem("gs_alerts_asked", "1"); }, [pin, address]);
  await page.reload();
}
