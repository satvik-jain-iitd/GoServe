// Story 1598: the screen gate must turn red on a low-contrast change. Fixture: the same 200x30 band of founder-note.png before and after the zigzag was hidden (#1164):
// the zigzag and the torn letter top are light on light, 3725 pixels differ in the band, and with Playwright's default threshold 0.2 none of them counted.
// The count below uses Playwright's own pixel rule (pixelmatch: the YIQ colour distance, squared, against 35215 * threshold^2).
import { describe, it, expect } from "vitest";
import band from "./fixtures/zigzag-band.json";
import { SCREEN_MAX_DIFF_PIXELS, SCREEN_THRESHOLD } from "../e2e/gate";

const bytes = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));
const yiq = (a: Uint8Array, b: Uint8Array, i: number): number => {
  const dr = a[i] - b[i], dg = a[i + 1] - b[i + 1], db = a[i + 2] - b[i + 2];
  const y = dr * 0.29889531 + dg * 0.58662247 + db * 0.11448223, u = dr * 0.59597799 - dg * 0.2741761 - db * 0.32180189, v = dr * 0.21147017 - dg * 0.52261711 + db * 0.31114694;
  return 0.5053 * y * y + 0.299 * u * u + 0.1957 * v * v;
};
const counted = (threshold: number): number => {
  const a = bytes(band.stale), b = bytes(band.fresh), max = 35215 * threshold * threshold;
  let n = 0;
  for (let i = 0; i < a.length; i += 3) if (yiq(a, b, i) > max) n++;
  return n;
};

describe("the screen gate", () => {
  it("sees the zigzag band that was hidden: more different pixels than the gate allows", () => {
    expect(counted(SCREEN_THRESHOLD)).toBeGreaterThan(SCREEN_MAX_DIFF_PIXELS);
  });
  it("the fixture is a real change: pixels differ", () => {
    expect(counted(0.001)).toBeGreaterThan(100);
  });
});
