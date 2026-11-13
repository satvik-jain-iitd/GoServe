// Stories 1396 and 1415: the phone's Back button closes what is on top and shows the screen under it.
// Order: an open sheet first (every customer sheet), then a screen (You, Deliver to, the bill, the tracker, orders, a slip, the pin map); on the menu Back leaves the app.
// Each sheet and screen adds one history step; closing it with its own button takes that step away again, so Back never lands on a stale step.
// history.go() is not instant: while a step is being taken away, the next push or replace waits for its popstate (a sheet that opens the next thing in one tap).
// A reload keeps the history: the first screen takes the step it already had instead of pushing a second one.
// Radar run 13 Nov 2026 ("react back button close modal"): nothing that fits; this is the few lines it takes.
import { useEffect, useRef } from "react";

type Screen = { gsScreen?: string; gsDepth?: number; gsSheet?: boolean } | null;
const sheets: { close: () => void }[] = [];
let skip = 0;   // history moves this file made itself and still waits for: their popstate is not a Back press
const waiting: (() => void)[] = [];   // pushes and replaces held until those moves land
let depth = 0;   // screen steps on top of the menu
let onScreen: ((screen: string) => void) | null = null;
let started = false;
let first = true;

const here = () => window.location.pathname + window.location.search;   // never copy the sign-in return hash into a new step
const drop = (n: number) => { if (n > 0) { skip++; window.history.go(-n); } };
const write = (fn: () => void) => { if (skip > 0) waiting.push(fn); else fn(); };

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("popstate", (e) => {
    if (skip > 0) { skip--; if (skip === 0) waiting.splice(0).forEach((fn) => fn()); return; }
    if (/access_token=/.test(window.location.hash)) { window.history.back(); return; }   // the sign-in return is not a step a customer goes back to
    const top = sheets.pop();
    if (top) { top.close(); return; }
    const s = e.state as Screen;
    depth = s?.gsDepth ?? 0;
    onScreen?.(s?.gsScreen ?? "menu");
  });
}

/** A sheet that is open adds a Back step; Back closes it. */
export function useBackCloses(open: boolean, close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    start();
    const me = { close: () => latest.current() };
    sheets.push(me);
    write(() => window.history.pushState({ ...(window.history.state ?? {}), gsSheet: true }, "", here()));
    return () => {
      const i = sheets.indexOf(me);
      if (i < 0) return;   // Back closed it: its step is already gone
      sheets.splice(i, 1);
      drop(1);   // closed by its own button: take its step away
    };
  }, [open]);
}

/** The app moved to `screen`. A screen with a Back step adds one; the menu goes back to the menu's step.
 * `replace`: the screen takes the place of the one it came from (story 1415: the bill becomes the tracker once the order is placed, so Back shows the menu). */
export function screenStep(screen: string, stepped: boolean, replace = false) {
  start();
  const kept = first ? (window.history.state as Screen) : null;
  first = false;
  if (kept?.gsScreen === screen && !kept.gsSheet && kept.gsDepth) { depth = kept.gsDepth; return; }   // a reload on this screen: its step is still there
  if (!stepped) { drop(depth); depth = 0; return; }
  if (replace && depth > 0) { const d = depth; write(() => window.history.replaceState({ gsScreen: screen, gsDepth: d }, "", here())); return; }
  depth++;
  const d = depth;
  write(() => window.history.pushState({ gsScreen: screen, gsDepth: d }, "", here()));
}

/** Back landed on the step of `screen`. */
export function onBackScreen(fn: (screen: string) => void) {
  start();
  onScreen = fn;
}
