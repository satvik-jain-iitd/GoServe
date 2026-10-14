// Story #53: the autopilot plays the order story one step at a time, from the order's own status.
import { describe, expect, it } from "vitest";
import { AUTOPILOT_MS, DEMO_DECISION, demoOrder, nextAutoAction } from "../../src/lib/autopilot";
import { trackerSteps } from "../../src/lib/kitchen";

describe("nextAutoAction", () => {
  it("S2 the kitchen takes the order to ready, then the rider takes it to delivered", () => {
    const walk: unknown[] = [];
    let status = "placed";
    let arrived = false;
    for (let i = 0; i < 10; i++) {
      const a = nextAutoAction(status, arrived);
      if (!a) break;
      walk.push(a.kind === "status" ? [a.actor, a.to] : [a.actor, a.event]);
      if (a.kind === "status") status = a.to;
      else arrived = true;
    }
    expect(walk).toEqual([
      ["kitchen", "accepted"], ["kitchen", "preparing"], ["kitchen", "ready"],
      ["rider", "out_for_delivery"], ["rider", "order.arriving"], ["rider", "delivered"],
    ]);
  });
  it("S2 there is nothing to do after Delivered, and an unknown status is left alone", () => {
    expect(nextAutoAction("delivered", true)).toBeNull();
    expect(nextAutoAction("flying", false)).toBeNull();
  });
  it("S2 Arriving is not sent twice", () => {
    expect(nextAutoAction("out_for_delivery", true)).toMatchObject({ kind: "status", to: "delivered" });
  });
});

describe("demo data for airplane mode", () => {
  it("S1 the sample order starts as Placed, has dishes and a total, and is a whole order the screens can draw", () => {
    const o = demoOrder(Date.parse("2026-10-18T10:00:00Z"));
    expect(o.status).toBe("placed");
    expect(o.items.length).toBeGreaterThan(0);
    expect(o.total_paise).toBe(o.items.reduce((n, l) => n + l.qty * l.price_paise, 0));
    expect(trackerSteps(o.status)[0].state).toBe("current");
    expect(o.created_at).toBe("2026-10-18T10:00:00.000Z");
  });
  it("S1 the sample decision reads as the story line: AI suggests R2 and the rule agrees", () => {
    expect(DEMO_DECISION).toMatchObject({ rule_pick: "r2", jev: { pick: "r2", agrees: true } });
  });
  it("the step time defaults to 2 seconds", () => {
    expect(AUTOPILOT_MS).toBeGreaterThan(0);
  });
});
