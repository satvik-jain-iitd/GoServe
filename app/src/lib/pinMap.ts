// Story #1037 (board C6-PinMap): the words and the strips of the pin map card.
import type { V2Deps } from "./ordersV2";
import { metres } from "./riderMap";
import type { Place } from "./locate";

export const cardWords = (address: string | null): { name: string; rest: string } => {
  const parts = (address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length === 0 ? { name: "Pin on the map", rest: "" } : { name: parts[0], rest: parts.slice(1).join(", ") };
};

export type Serve = { serviceable: boolean; kitchenM: number | null };
export type Strip = { kind: "ready" | "warn" | "error"; text: string };
const FAR_FROM_PHONE_M = 2_000;   // assumption: past 2 km from where the phone is, the customer is told the pin is elsewhere

export function stripsFor(o: { serve: Serve | null; here: Place | null; pin: Place }): Strip[] {
  const out: Strip[] = [];
  if (o.serve?.serviceable) out.push({ kind: "ready", text: `We deliver here · the kitchen is ${o.serve.kitchenM === null ? "near" : kitchenWord(o.serve.kitchenM)} from the pin` });
  else if (o.serve) out.push({ kind: "error", text: "Not in our area yet" });
  if (o.here) {
    const m = metres(o.here.lat, o.here.lng, o.pin.lat, o.pin.lng);
    if (m > FAR_FROM_PHONE_M) out.push({ kind: "warn", text: `${m < 10_000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)} km from where you are now` });
  }
  return out.slice(0, 2);
}
const kitchenWord = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

// One call to the serviceability function: can a kitchen reach this place, and how far is the nearest one. null = could not ask.
export async function serveAt(p: Place, deps?: V2Deps): Promise<Serve | null> {
  try {
    const d = deps ?? (await import("./ordersV2")).v2Deps();
    const res = await d.fetchFn(`${d.url}/functions/v1/serviceability?lat=${p.lat}&lng=${p.lng}`, { headers: { apikey: d.anon, authorization: `Bearer ${await d.token()}` } });
    if (!res.ok) return null;
    const body = await res.json();
    if (body?.ok !== true || typeof body.serviceable !== "boolean" || !Array.isArray(body.kitchens)) return null;
    const first = body.kitchens[0];
    return { serviceable: body.serviceable, kitchenM: body.serviceable && typeof first?.distance_m === "number" ? first.distance_m : null };
  } catch {
    return null;
  }
}
