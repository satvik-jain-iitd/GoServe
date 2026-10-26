// Story M.2 (#321): the one rule for "is this kitchen open now". India time, whatever the phone's time zone.
// The switch (`open`) and `active` can always close a kitchen. Opening hours close it too, when both are set. No hours: the switch alone decides.
// The server uses the same rule (migration 0041, kitchen_open_now), so a customer cannot order from a kitchen the screen calls closed.
type Hours = { open: boolean; active: boolean; opens_at?: string | null; closes_at?: string | null };

const minutes = (t: string): number => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function isOpenNow(k: Hours, now: Date): boolean {
  if (!k.open || !k.active) return false;
  if (!k.opens_at || !k.closes_at) return true;
  const here = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;   // India is UTC+5:30, no daylight saving
  const from = minutes(k.opens_at), to = minutes(k.closes_at);
  if (from === to) return true;
  return from < to ? here >= from && here < to : here >= from || here < to;   // from > to: opens one evening, closes after midnight
}
