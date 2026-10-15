// Story #51: the ops screen. The suggestion line comes from one decision_log row; the metrics are plain numbers.
import { describe, expect, it } from "vitest";
import { DEMO_RIDERS, formatMs, median, riderLabel, suggestionText, type Decision } from "../../src/lib/ops";

const base: Decision = { rule_pick: "r2", chosen_pick: "r2", jev_status: "ok", jev: { pick: "r2", confidence: 0.81, agrees: true } };

describe("suggestionText", () => {
  it("S1 says what the AI suggests and that the rule agrees", () => {
    expect(suggestionText(base)).toBe("AI suggests rider R2 (81%). The rule agrees.");
  });
  it("S1 says which rider the rule picked when the AI disagrees", () => {
    expect(suggestionText({ ...base, jev: { pick: "r1", confidence: 0.81, agrees: false } })).toBe("AI suggests rider R1 (81%). The rule picked R2.");
  });
  it("S1 says a low confidence suggestion was too unsure to use", () => {
    expect(suggestionText({ ...base, jev_status: "jev_low_confidence", jev: { pick: "r1", confidence: 0.55, agrees: false } }))
      .toBe("AI suggests rider R1 (55%), too unsure to use. The rule picked R2.");
  });
  it("S1 says why there is no suggestion", () => {
    const none = (jev_status: string) => suggestionText({ ...base, jev: null, jev_status });
    expect(none("jev_off")).toBe("AI gave no suggestion (it is off). The rule picked R2.");
    expect(none("jev_error")).toBe("AI gave no suggestion (it did not answer). The rule picked R2.");
    expect(none("jev_bad_reply")).toBe("AI gave no suggestion (its reply was not usable). The rule picked R2.");
    expect(none("cost_cap")).toBe("AI gave no suggestion (the call cost too much). The rule picked R2.");
  });
  it("S1 says when no rider is free", () => {
    expect(suggestionText({ ...base, rule_pick: "none", chosen_pick: "none", jev: null, jev_status: "jev_off" })).toBe("No rider is free.");
  });
});

describe("helpers", () => {
  it("riderLabel shows R2 for r2", () => expect(riderLabel("r2")).toBe("R2"));
  it("formatMs shows ms under a second and seconds above", () => {
    expect(formatMs(420)).toBe("420 ms");
    expect(formatMs(1830)).toBe("1.8 s");
  });
  it("median of lag numbers", () => {
    expect(median([])).toBeNull();
    expect(median([900, 300, 600])).toBe(600);
    expect(median([100, 300])).toBe(200);
  });
  it("the demo riders: three, one busy, so the rule picks r2", () => {
    expect(DEMO_RIDERS.map((r) => [r.id, r.free])).toEqual([["r1", true], ["r2", true], ["r3", false]]);
  });
});
