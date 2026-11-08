// Story #1101: what the live end-to-end spec needs and nothing else. DEV ONLY: it refuses any project that is not goserve-dev.
// It makes a world of its own (one kitchen with two dishes, a kitchen user, a rider, an admin; the phone number is the customer's), hands out signed-in browser
// sessions for the staff (a password user minted with the service-role key, no Google), reads the trace, and deletes everything it made.
// The keys are read from the Secrets vault file and never printed, logged or put in a screenshot.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const DEV_REF = "tmxyizmkpwwfyazvrfhw";
const vault = ["goserve/goserve.env", "02_databases.env"].map((f) => { try { return readFileSync(`${homedir()}/Desktop/Secrets/${f}`, "utf8"); } catch { return ""; } }).join("\n");
const get = (k: string) => process.env[k] ?? vault.match(new RegExp(`^${k}=(\\S+)`, "m"))?.[1] ?? "";
export const URL_ = get("SUPABASE_GOSERVE_DEV_URL");
const ANON = get("SUPABASE_GOSERVE_DEV_ANON_KEY");
const SERVICE = get("SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY");
const MGMT = get("SUPABASE_ACCESS_TOKEN");
if (!URL_.includes(DEV_REF)) throw new Error("live spec: the dev project keys are missing, or this is not goserve-dev. It never runs anywhere else.");

export const PIN = "403725";   // a pin of the pincodes table with no other kitchen; the kitchen of the run takes it
export const AT = { latitude: 15.25, longitude: 73.9417 };   // its centroid: the phone stands here
export const NO_KITCHEN_PIN = "194101";   // another pin of the table, no kitchen: the NK-A screen
export const NO_KITCHEN_AT = { latitude: 34.1667, longitude: 77.5833 };
export const FIXED_CODE = "123456";

type Json = Record<string, unknown>;
const api = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}, key = SERVICE): Promise<{ status: number; data: any }> => {
  const res = await fetch(URL_ + path, { method, headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 200); }
  return { status: res.status, data };
};
export const sql = async (query: string): Promise<any[]> => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${DEV_REF}/database/query`, { method: "POST", headers: { authorization: `Bearer ${MGMT}`, "content-type": "application/json", "user-agent": "goserve-live" }, body: JSON.stringify({ query }) });
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`sql failed: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
};

export type Staff = { id: string; email: string; session: string };   // `session` is the JSON the browser keeps under sb-<ref>-auth-token
export type World = {
  run: string; kitchenId: string; kitchenName: string; dishes: { id: string; name: string }[];
  kitchen: Staff; rider: Staff; admin: Staff; users: string[];
};

async function staff(run: string, who: string): Promise<Staff> {
  const email = `live-${who}-${run}@goserve-live.test`;
  const password = randomUUID();
  const made = await api("POST", "/auth/v1/admin/users", { email, password, email_confirm: true });
  if (made.status >= 300) throw new Error(`could not make the ${who} user: ${made.status}`);
  const id: string = made.data.id;
  const login = await api("POST", "/auth/v1/token?grant_type=password", { email, password }, {}, ANON);
  if (login.status >= 300) throw new Error(`could not sign the ${who} user in: ${login.status}`);
  return { id, email, session: JSON.stringify(login.data) };
}

export async function makeWorld(): Promise<World> {
  const run = randomUUID().slice(0, 6);
  const kitchenId = randomUUID();
  const kitchenName = `Live Check ${run}`;
  const [kitchen, rider, admin] = [await staff(run, "kitchen"), await staff(run, "rider"), await staff(run, "admin")];
  const k = await api("POST", "/rest/v1/kitchens", { id: kitchenId, name: kitchenName, address: "Live check, Goa", pin_codes: [PIN], lat: AT.latitude, lng: AT.longitude, open: true, active: true, opens_at: "00:00", closes_at: "23:59", synthetic: false }, { prefer: "return=minimal" });
  if (k.status >= 300) throw new Error(`could not make the kitchen: ${k.status} ${JSON.stringify(k.data).slice(0, 160)}`);
  const dishes = [{ id: randomUUID(), name: `Live thali ${run}` }, { id: randomUUID(), name: `Live dal ${run}` }];
  await api("POST", "/rest/v1/menu_items", dishes.map((d, i) => ({ id: d.id, kitchen_id: kitchenId, name: d.name, price_paise: 12000 + i * 3000, available: true, veg: true, sort: i, category: "Mains" })), { prefer: "return=minimal" });
  await api("POST", "/rest/v1/kitchen_staff", { kitchen_id: kitchenId, user_id: kitchen.id, role: "staff" }, { prefer: "return=minimal" });
  await api("POST", "/rest/v1/admins", { user_id: admin.id }, { prefer: "return=minimal" });
  await api("POST", "/rest/v1/riders", { user_id: rider.id, name: `Live Rider ${run}`, phone: "9000000000", online: false, lat: AT.latitude + 0.002, lng: AT.longitude, updated_at: new Date().toISOString(), synthetic: false }, { prefer: "return=minimal" });
  return { run, kitchenId, kitchenName, dishes, kitchen, rider, admin, users: [kitchen.id, rider.id, admin.id] };
}

/** A synthetic web-push subscription for a customer: a real address of Mozilla's push service with a bogus token, so the push service answers 404 and the function forgets it
 *  after one send. Arm it again before every alert that should be sent. No phone is notified. */
export async function armPush(session: string): Promise<void> {
  const endpoint = `https://updates.push.services.mozilla.com/wpush/v2/live${randomUUID().replace(/-/g, "")}`;
  await api("POST", "/rest/v1/push_subscriptions", { session_id: session, endpoint, p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" }, { prefer: "return=minimal" });
}

/** One line per alert: the order trace from push_queued to push_sent (or push_failed / push_skipped), in seconds. */
export async function pushTrace(orderId: string): Promise<{ status: string | null; queued_to_sent_s: number | null; events: string[] }[]> {
  const rows = await sql(`select event, result, at from order_trace where order_id = '${orderId}' and event like 'push_%' order by at, id`);
  const out: { status: string | null; queued_to_sent_s: number | null; events: string[] }[] = [];
  let open: { status: string; at: number; events: string[] } | null = null;
  for (const r of rows) {
    const at = new Date(r.at).getTime();
    if (r.event === "push_queued") { open = { status: String(r.result ?? ""), at, events: ["push_queued"] }; continue; }
    if (!open) continue;
    open.events.push(r.event);
    if (r.event === "push_sent") { out.push({ status: open.status, queued_to_sent_s: Math.round((at - open.at) / 100) / 10, events: open.events }); open = null; }
    else if (r.event === "push_failed" || r.event === "push_skipped") { out.push({ status: open.status, queued_to_sent_s: null, events: open.events }); open = null; }
  }
  if (open) out.push({ status: open.status, queued_to_sent_s: null, events: open.events });
  return out;
}

export const storageKey = `sb-${DEV_REF}-auth-token`;

export async function cleanup(w: World, customerIds: string[]): Promise<void> {
  const ids = [...w.users, ...customerIds];
  const list = ids.map((i) => `'${i}'`).join(", ");
  const own = `select id from orders where kitchen_id = '${w.kitchenId}'`;
  const who = customerIds.length ? customerIds.map((i) => `'${i}'`).join(", ") : "''";
  const steps = [
    `delete from push_outbox where order_id in (${own})`, `delete from order_events where order_id in (${own})`, `delete from order_trace where order_id in (${own})`,
    `delete from decision_log where order_id in (${own})`, `delete from orders where kitchen_id = '${w.kitchenId}'`,
    `delete from area_requests where user_id::text in (${who})`, `delete from push_subscriptions where session_id in (${list})`,
    `delete from addresses where user_id::text in (${who})`, `delete from customers where user_id::text in (${who})`,
    `delete from kitchen_staff where kitchen_id = '${w.kitchenId}'`, `delete from menu_items where kitchen_id = '${w.kitchenId}'`, `delete from kitchens where id = '${w.kitchenId}'`,
    `delete from riders where user_id = '${w.rider.id}'`, `delete from admins where user_id = '${w.admin.id}'`,
  ];
  for (const q of steps) await sql(`begin; select set_config('goserve.reset', 'on', true); ${q}; commit;`).catch((e) => console.log("cleanup:", q.slice(0, 40), String(e).slice(0, 120)));
  for (const id of ids) await api("DELETE", `/auth/v1/admin/users/${id}`).catch(() => undefined);
}
