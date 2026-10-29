// Story #207: product analytics (PostHog) is off unless a key is set, sends six named events, and no name, phone or address.
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EVENTS, capture, initAnalytics, resetAnalytics } from "../../src/lib/analytics";

const fakePosthog = () => ({ init: vi.fn(), capture: vi.fn() });
const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("analytics", () => {
  it("S1 without a key nothing is loaded and capture does nothing", async () => {
    resetAnalytics();
    const load = vi.fn();
    await initAnalytics({}, load as never, store());
    capture("order_placed");
    expect(load).not.toHaveBeenCalled();
  });

  it("S2 with a key: EU host by default, autocapture, page views and session replay off, no profiles for anonymous people", async () => {
    resetAnalytics();
    const ph = fakePosthog();
    await initAnalytics({ VITE_POSTHOG_KEY: "phc_test" }, (async () => ph) as never, store());
    const [key, cfg] = ph.init.mock.calls[0];
    expect(key).toBe("phc_test");
    expect(cfg).toMatchObject({ api_host: "https://eu.i.posthog.com", autocapture: false, capture_pageview: false, capture_pageleave: false, disable_session_recording: true, person_profiles: "identified_only" });
  });

  it("S3 the host comes from VITE_POSTHOG_INGEST", async () => {
    resetAnalytics();
    const ph = fakePosthog();
    await initAnalytics({ VITE_POSTHOG_KEY: "k", VITE_POSTHOG_INGEST: "https://x.example" }, (async () => ph) as never, store());
    expect(ph.init.mock.calls[0][1].api_host).toBe("https://x.example");
  });

  it("S4 the six events, and capture sends the name and its props", async () => {
    expect([...EVENTS]).toEqual(["first_open", "code_ok", "address_set", "order_placed", "delivered_yes", "feedback_sent"]);
    resetAnalytics();
    const ph = fakePosthog();
    await initAnalytics({ VITE_POSTHOG_KEY: "k" }, (async () => ph) as never, store());
    capture("order_placed", { items_count: 2 });
    await Promise.resolve();
    expect(ph.capture).toHaveBeenCalledWith("order_placed", { items_count: 2 });
  });

  it("S5 first_open is sent once per phone", async () => {
    resetAnalytics();
    const ph = fakePosthog();
    const s = store();
    await initAnalytics({ VITE_POSTHOG_KEY: "k" }, (async () => ph) as never, s);
    await initAnalytics({ VITE_POSTHOG_KEY: "k" }, (async () => ph) as never, s);
    await Promise.resolve();
    expect(ph.capture.mock.calls.filter((c) => c[0] === "first_open")).toHaveLength(1);
  });

  it("S6 every capture( in the source uses a listed event and no personal prop", () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); });
    walk(join(__dirname, "../../src"));
    const used: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/\bcapture\(\s*"([a-z_]+)"([^)]*)\)/g)) {
        used.push(m[1]);
        expect(m[2], `${f} sends a personal prop`).not.toMatch(/\b(name|phone|address|email)\b/);
      }
    }
    expect(used.length).toBeGreaterThanOrEqual(5);
    for (const u of used) expect(EVENTS as readonly string[]).toContain(u);
  });

  it("S7 only the dev deploy carries the key; the prod deploy does not (dev only for now)", () => {
    const dev = readFileSync(join(__dirname, "../../../.github/workflows/deploy-dev.yml"), "utf8");
    const prod = readFileSync(join(__dirname, "../../../.github/workflows/deploy-app.yml"), "utf8");
    expect(dev).toContain("VITE_POSTHOG_KEY");
    expect(prod).not.toContain("POSTHOG");
  });
});
