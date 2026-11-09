// Story #1168: the board-match comparison itself. A board anchor matches an app element by tag and text; the box must be within 4 px; order, font, colour and background must agree;
// a board anchor with no app element and an app button with no board anchor are failures.
import { describe, expect, it } from "vitest";
import { compare, geometry, type Anchor } from "../e2e/boardMatch";

const a = (tag: string, text: string, box: [number, number, number, number], extra: Partial<Anchor> = {}): Anchor => ({ tag, cls: "", text, box, font: "16px", color: "rgb(0, 0, 0)", bg: "rgba(0, 0, 0, 0)", ...extra });
const withBoard = (name: string, list: Anchor[]) => { geometry[name] = list; return name; };

describe("compare", () => {
  it("passes when text, box, font, colour and background agree", () => {
    const b = withBoard("T1", [a("h2", "Get order alerts", [39, 239, 312, 24]), a("button", "Turn on alerts", [39, 745, 312, 56])]);
    expect(compare(b, [a("h2", "Get order alerts", [39, 241, 312, 24]), a("button", "Turn on alerts", [39, 745, 312, 56])]).failures).toEqual([]);
  });
  it("names a box that is more than 4 px away, with the board and the app value", () => {
    const b = withBoard("T2", [a("button", "Turn on alerts", [39, 745, 312, 56])]);
    const f = compare(b, [a("button", "Turn on alerts", [39, 745, 312, 64])]).failures;
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ check: "height", expected: "56", seen: "64" });
  });
  it("lists a board anchor the app lacks, and a button the app has that the board lacks", () => {
    const b = withBoard("T3", [a("button", "Save address", [20, 700, 350, 56])]);
    const f = compare(b, [a("button", "Cancel", [20, 600, 100, 40])]).failures.map((x) => x.check).sort();
    expect(f).toEqual(["extra", "missing"]);
  });
  it("fails the order when the app shows two anchors the other way round", () => {
    const b = withBoard("T4", [a("h2", "One", [20, 100, 100, 20]), a("h2", "Two", [20, 200, 100, 20])]);
    expect(compare(b, [a("h2", "One", [20, 300, 100, 20]), a("h2", "Two", [20, 100, 100, 20])]).failures.some((x) => x.check === "order")).toBe(true);
  });
  it("takes a row's sample second line and a trailing arrow as the same words, and an alias for sample data", () => {
    const b = withBoard("T5", [a("button", "Saved addresses Home, Work, and 1 more ›", [16, 100, 358, 56]), a("h3", "Dal Makhani", [20, 200, 100, 20])]);
    const app = [a("button", "Saved addresses ›", [16, 100, 358, 56]), a("h3", "Butter Chicken", [20, 200, 100, 20])];
    expect(compare(b, app, { "Dal Makhani": "Butter Chicken" }).failures).toEqual([]);
  });
  it("ships the geometry of the approved boards", () => {
    expect(Object.keys(geometry).length).toBeGreaterThanOrEqual(50);
    expect(geometry["Y4b-YouPageCards"].length).toBeGreaterThan(5);
  });
});
