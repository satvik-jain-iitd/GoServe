// Story 1396: the phone's Back button closes what is on top and shows the screen under it.
// Order: an open sheet first, then a screen (You, Deliver to), and on the menu Back leaves the app.
// Each sheet and screen adds one history step; closing it with its own button takes that step away again, so Back never lands on a stale step.
// Radar run 13 Nov 2026 ("react back button close modal"): nothing that fits; this is the few lines it takes.
import { useEffect, useRef } from "react";

type Screen = { gsScreen?: string; gsDepth?: number } | null;
const sheets: { close: () => void }[] = [];
let skip = 0;   // history moves this file made itself: their popstate is not a Back press
let depth = 0;   // screen steps on top of the menu
let onScreen: ((screen: string) => void) | null = null;
let started = false;

const here = () => window.location.pathname + window.location.search;   // never copy the sign-in return hash into a new step
const drop = (n: number) => { if (n > 0) { skip++; window.history.go(-n); } };

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("popstate", (e) => {
    if (skip > 0) { skip--; return; }
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
    window.history.pushState({ ...(window.history.state ?? {}), gsSheet: true }, "", here());
    return () => {
      const i = sheets.indexOf(me);
      if (i < 0) return;   // Back closed it: its step is already gone
      sheets.splice(i, 1);
      drop(1);   // closed by its own button: take its step away
    };
  }, [open]);
}

/** The app moved to `screen`. A screen with a Back step (You, Deliver to) adds one; any other screen goes back to the menu's step. */
export function screenStep(screen: string, stepped: boolean) {
  start();
  if (!stepped) { drop(depth); depth = 0; return; }
  depth++;
  window.history.pushState({ gsScreen: screen, gsDepth: depth }, "", here());
}

/** Back landed on the step of `screen`. */
export function onBackScreen(fn: (screen: string) => void) {
  start();
  onScreen = fn;
}
