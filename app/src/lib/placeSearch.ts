// Story #1036 (board C8-SearchResults): places for the Deliver to search box, from our own pincodes table through the place-search function. Story #1519: the server asks Ola Maps near the map first and our table is the backup; the box asks while you type.
import { useEffect, useRef, useState } from "react";
import type { V2Deps } from "./ordersV2";
import type { Place } from "./locate";

export type PlaceHit = { name: string; address: string; lat: number; lng: number; pin: string; served: boolean; from?: "ola" | "own" };   // story 1519: where the row came from; an old server sends none, which reads as our own table
const isHit = (r: unknown): r is PlaceHit => {
  const h = r as PlaceHit;
  return !!h && typeof h.name === "string" && typeof h.address === "string" && typeof h.lat === "number" && typeof h.lng === "number" && typeof h.pin === "string" && typeof h.served === "boolean";
};

// null = could not search (error, slow down, no network); [] = nothing matches.
// Story 1519: `at` is the place the map (or the phone) is on, so the server can ask for places near it. The rows come in the server's order.
export async function placeSearch(q: string, at?: Place, deps?: V2Deps): Promise<PlaceHit[] | null> {
  try {
    const d = deps ?? (await import("./ordersV2")).v2Deps();
    const res = await d.fetchFn(`${d.url}/functions/v1/place-search?q=${encodeURIComponent(q)}${at ? `&lat=${at.lat}&lng=${at.lng}` : ""}`, { headers: { apikey: d.anon, authorization: `Bearer ${await d.token()}` } });
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

export type Search = (q: string, at?: Place) => Promise<PlaceHit[] | null>;
export type Found = { words: string; state: "busy" | "short" | "error" | "ok"; hits: PlaceHit[] } | null;
const PAUSE_MS = 400;
// Story 1519, for both search boxes (the pin map and Deliver to). `q` is what the box holds. Three letters and a pause of PAUSE_MS ask by themselves; `ask` (Enter) asks at once.
// A change of the words drops any answer still on its way, so an older answer never replaces a newer one. The rows on screen stay until the new rows come (no flicker);
// "Searching…" (busy) shows only when there are no rows. Under 3 letters the rows go at once.
export function usePlaces(q: string, search: Search | undefined, at?: Place | null): { found: Found; ask: () => void } {
  const [found, setFound] = useState<Found>(null);
  const live = useRef({ asked: "", search, at });
  live.current.search = search; live.current.at = at;
  const run = useRef(async (w: string) => {
    const l = live.current;
    if (!l.search) return;
    if (w.length < 3) return setFound({ words: w, state: "short", hits: [] });
    l.asked = w;
    setFound((c) => (c?.hits.length ? c : { words: w, state: "busy", hits: [] }));
    const hits = await l.search(w, l.at ?? undefined);
    if (l.asked === w) setFound({ words: w, state: hits === null ? "error" : "ok", hits: hits ?? [] });
  }).current;
  useEffect(() => {
    live.current.asked = "";
    const w = q.trim();
    if (w.length < 3) return setFound(null);
    const t = setTimeout(() => { if (live.current.asked !== w) void run(w); }, PAUSE_MS);   // Enter already asked for these words: no second ask
    return () => clearTimeout(t);
  }, [q, run]);
  return { found, ask: () => void run(q.trim()) };
}

// Ola Platform Terms, section 15: the words "Ola Maps" show with any row that came from Ola.
export const fromOla = (hits: PlaceHit[]) => hits.some((h) => h.from === "ola");
