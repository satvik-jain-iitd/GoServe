// Story S-B (#94): the trail is the last 20 things the tester did in the app. It travels with every feedback report.
import { beforeEach, describe, expect, it } from "vitest";
import { clearTrail, pushTrail, readTrail, TRAIL_MAX } from "../../src/lib/trail";

describe("trail", () => {
  beforeEach(clearTrail);

  it("keeps the newest 20 lines, oldest first", () => {
    for (let i = 1; i <= 25; i++) pushTrail(`tap ${i}`);
    const lines = readTrail().map((e) => e.line);
    expect(TRAIL_MAX).toBe(20);
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe("tap 6");
    expect(lines[19]).toBe("tap 25");
  });

  it("stamps each line with a time and cuts a very long line", () => {
    pushTrail("x".repeat(500));
    const [e] = readTrail();
    expect(e.line.length).toBeLessThanOrEqual(120);
    expect(Number.isNaN(Date.parse(e.at))).toBe(false);
  });

  it("returns a copy, so a caller cannot change the trail", () => {
    pushTrail("a");
    readTrail().pop();
    expect(readTrail()).toHaveLength(1);
  });
});
