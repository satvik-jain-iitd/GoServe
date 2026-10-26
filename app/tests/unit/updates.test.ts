// Story M.1 (#320, plan v2 H.1): an installed iPhone app that stays open in the background must still get the new build.
// Two causes: the service worker is only checked on a page load, and a new worker that takes over does not reload the page.
import { describe, expect, it } from "vitest";
import { buildLabel, watchForUpdates } from "../../src/lib/updates";

type Listener = () => void;
const fakeSw = (controller: object | null) => {
  const l: Record<string, Listener[]> = {};
  const reg = { updates: 0, update: async () => { reg.updates++; } };
  const sw = { controller, listeners: l, addEventListener: (e: string, f: Listener) => { (l[e] ??= []).push(f); }, getRegistration: async () => reg };
  return { sw, reg, fire: (e: string) => (l[e] ?? []).forEach((f) => f()) };
};
const fakeDoc = (state: "visible" | "hidden" = "visible") => {
  const l: Listener[] = [];
  const d = { visibilityState: state, addEventListener: (_: string, f: Listener) => l.push(f) };
  return { d, show: () => { d.visibilityState = "visible"; l.forEach((f) => f()); }, hide: () => { d.visibilityState = "hidden"; l.forEach((f) => f()); } };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("watchForUpdates", () => {
  it("checks for a new build each time the app comes back to the front, and only then", async () => {
    const s = fakeSw({}), doc = fakeDoc("hidden");
    watchForUpdates(s.sw as never, doc.d as never, () => undefined);
    doc.hide(); await tick();
    expect(s.reg.updates).toBe(0);   // going to the background checks nothing
    doc.show(); await tick();
    expect(s.reg.updates).toBe(1);
    doc.hide(); doc.show(); await tick();
    expect(s.reg.updates).toBe(2);
  });

  it("reloads once when a new worker takes over an app that already had one", () => {
    const s = fakeSw({}), doc = fakeDoc();
    let reloads = 0;
    watchForUpdates(s.sw as never, doc.d as never, () => { reloads++; });
    s.fire("controllerchange"); s.fire("controllerchange");
    expect(reloads).toBe(1);   // a second event in the same life does not loop
  });

  it("does not reload on the first install (there was no controller before)", () => {
    const s = fakeSw(null), doc = fakeDoc();
    let reloads = 0;
    watchForUpdates(s.sw as never, doc.d as never, () => { reloads++; });
    s.fire("controllerchange");
    expect(reloads).toBe(0);
  });

  it("does nothing when the browser has no service worker, and survives a failing update", async () => {
    expect(() => watchForUpdates(undefined, fakeDoc().d as never, () => undefined)).not.toThrow();
    const s = fakeSw({}), doc = fakeDoc("hidden");
    s.reg.update = async () => { throw new Error("offline"); };
    watchForUpdates(s.sw as never, doc.d as never, () => undefined);
    doc.show(); await tick();   // no unhandled rejection
  });
});

describe("buildLabel", () => {
  it("shows the first 7 characters of a commit, and dev when there is none", () => {
    expect(buildLabel("1a2b3c4d5e6f")).toBe("Build 1a2b3c4");
    expect(buildLabel(undefined)).toBe("Build dev");
    expect(buildLabel("")).toBe("Build dev");
    expect(buildLabel("dev")).toBe("Build dev");
  });
});
