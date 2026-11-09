// Story #1036 (board C8-SearchResults): places for the Deliver to search box, from our own pincodes table through the place-search function. No outside search; the box asks on submit only.
import type { V2Deps } from "./ordersV2";

export type PlaceHit = { name: string; address: string; lat: number; lng: number; pin: string; served: boolean };
const isHit = (r: unknown): r is PlaceHit => {
  const h = r as PlaceHit;
  return !!h && typeof h.name === "string" && typeof h.address === "string" && typeof h.lat === "number" && typeof h.lng === "number" && typeof h.pin === "string" && typeof h.served === "boolean";
};

// null = could not search (error, slow down, no network); [] = nothing matches.
export async function placeSearch(q: string, deps?: V2Deps): Promise<PlaceHit[] | null> {
  try {
    const d = deps ?? (await import("./ordersV2")).v2Deps();
    const res = await d.fetchFn(`${d.url}/functions/v1/place-search?q=${encodeURIComponent(q)}`, { headers: { apikey: d.anon, authorization: `Bearer ${await d.token()}` } });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.ok === true && Array.isArray(body.results) ? body.results.filter(isHit).slice(0, 5) : null;
  } catch {
    return null;
  }
}

// [before, match, after] for the bold match in a row. Any case; the first match only.
export const splitMatch = (text: string, q: string): [string, string, string] => {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  return i < 0 ? [text, "", ""] : [text.slice(0, i), text.slice(i, i + q.length), text.slice(i + q.length)];
};
