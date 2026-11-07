// Story #932: no pinch zoom on any screen. The viewport meta carries the lock (Android, home screen), and a gesturestart listener covers Safari in a tab.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lockZoom } from "../../src/lib/zoomLock";

describe("zoom lock (story #932)", () => {
  const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
  const viewport = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? "";

  it("the viewport meta forbids zoom and keeps the full-screen fit", () => {
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("viewport-fit=cover");
    expect(viewport).toContain("maximum-scale=1");
    expect(viewport).toContain("user-scalable=no");
  });

  it("lockZoom stops the Safari pinch (gesturestart) and nothing else", () => {
    const target = new EventTarget();
    lockZoom(target);
    const pinch = new Event("gesturestart", { cancelable: true });
    target.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
    const tap = new Event("click", { cancelable: true });
    target.dispatchEvent(tap);
    expect(tap.defaultPrevented).toBe(false);
  });
});
