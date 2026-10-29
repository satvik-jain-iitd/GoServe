// Story #207: product analytics with PostHog. Off unless VITE_POSTHOG_KEY is set (dev only for now), so prod and every test send nothing.
// Six events only. A prop never carries a name, phone or address. Autocapture and session replay are off. Page views are on (story #738): one per history change, and a page leave on close; the app has one page per role app, so this is web analytics (visitors, paths, devices), not a per-screen trail.
export const EVENTS = ["first_open", "code_ok", "address_set", "order_placed", "delivered_yes", "feedback_sent"] as const;
export type EventName = (typeof EVENTS)[number];
type Env = { VITE_POSTHOG_KEY?: string; VITE_POSTHOG_INGEST?: string };
type Ph = { init: (key: string, cfg: Record<string, unknown>) => unknown; capture: (name: string, props?: Record<string, unknown>) => unknown };

let ready: Promise<Ph> | null = null;
export const resetAnalytics = () => { ready = null; };

export async function initAnalytics(env: Env, load: () => Promise<Ph> = () => import("posthog-js").then((m) => m.default as unknown as Ph), store?: Pick<Storage, "getItem" | "setItem">): Promise<void> {
  if (!env.VITE_POSTHOG_KEY || ready) return;
  const key = env.VITE_POSTHOG_KEY;
  ready = load().then((ph) => {
    ph.init(key, { api_host: env.VITE_POSTHOG_INGEST || "https://eu.i.posthog.com", autocapture: false, capture_pageview: "history_change", capture_pageleave: true, defaults: "2026-08-30",
      disable_session_recording: true, disable_surveys: true, person_profiles: "identified_only", persistence: "localStorage" });
    return ph;
  });
  const s = store ?? (() => { try { return window.localStorage; } catch { return undefined; } })();
  try {
    if (s && !s.getItem("gs.first_open")) { s.setItem("gs.first_open", "1"); capture("first_open"); }
  } catch { /* storage blocked: no first_open */ }
  await ready.catch(() => undefined);
}

export function capture(name: EventName, props?: Record<string, unknown>): void {
  void ready?.then((ph) => ph.capture(name, props)).catch(() => undefined);   // analytics never breaks the app
}
