// Story 1530: what a recent holds. Only the customer's own words and rows of our own postal code table; never an answer of Ola (search row or address lookup).
import { describe, expect, it } from "vitest";
import { keepRecent, recentWords, type Recent } from "../../src/lib/recents";

const hit = (from?: "ola" | "own") => ({ name: "Olaname Market", address: "Olaname Market, Olatown", lat: 1, lng: 2, pin: "110016", served: true, from });
const typed = { house: " 12B ", landmark: "near park gate", area: "" };

describe("recentWords", () => {
  it("a row of Ola: the words the customer typed in the search and in the details, nothing of the row", () => {
    const w = recentWords("  green park ", hit("ola"), typed);
    expect(w).toEqual({ name: "green park", address: "12B, near park gate, green park" });
    expect(JSON.stringify(w)).not.toMatch(/ola/i);
  });
  it("a row with no source is treated as Ola's", () => {
    expect(recentWords("green park", hit(), typed).name).toBe("green park");
  });
  it("a row of our own postal code table is kept as it is", () => {
    expect(recentWords("olan", hit("own"), typed)).toEqual({ name: "Olaname Market", address: "12B, near park gate, Olaname Market, Olatown" });
  });
  it("the area the customer typed on the details sheet wins over the search words", () => {
    expect(recentWords("green park", hit("ola"), { house: "12B", landmark: "", area: "Gali 3, Example Colony" }).address).toBe("12B, Gali 3, Example Colony");
  });
  it("long words are cut to what the table takes", () => {
    const w = recentWords("x".repeat(200), hit("ola"), { house: "h".repeat(120), landmark: "l".repeat(120), area: "a".repeat(200) });
    expect(w.name.length).toBe(80);
    expect(w.address.length).toBeLessThanOrEqual(300);
  });
});

// Story 1540 (the reviewer's ask on story 1530): when a confirmed place takes an older recent, and when it is no recent at all.
type Call = { op: "update" | "insert"; id?: string; row: Record<string, unknown> };
function fake() {   // the two calls keepRecent makes on recent_places, written down
  const calls: Call[] = [];
  const client = { from: () => ({
    update: (row: Record<string, unknown>) => ({ eq: async (_col: string, id: string) => { calls.push({ op: "update", id, row }); return { error: null }; } }),
    insert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => { calls.push({ op: "insert", row }); return { data: { id: "new", used_at: "2026-11-15T10:00:00Z", ...row }, error: null }; } }) }),
  }) } as unknown as Parameters<typeof keepRecent>[0];
  return { calls, client };
}
const OLD: Recent = { id: "r1", name: "Sample Nagar", address: "Flat 1, Sample Nagar", pin: "110016", lat: 28.57, lng: 77.24, house: "Flat 1", landmark: "", used_at: "2026-11-10T10:00:00Z", confirmed: true };
const place = (over: Partial<Recent> = {}) => ({ name: OLD.name, address: "Flat 2, Sample Nagar", pin: "110016", lat: OLD.lat, lng: OLD.lng, house: "Flat 2", landmark: "", ...over });
const M = 1 / 111_195;   // one metre of latitude, in degrees

describe("keepRecent", () => {
  // Story 1609 (owner, 17 Nov 2026): a tapped search result is kept at once, marked not confirmed; Confirm on the map updates that same row.
  it("a tap with no Confirm: one insert marked not confirmed", async () => {
    const { calls, client } = fake();
    await keepRecent(client, [], place(), false);
    expect(calls.map((c) => [c.op, c.row.confirmed])).toEqual([["insert", false]]);
  });
  it("Confirm on the same place after a tap: one update on that row, now confirmed, no second insert", async () => {
    const { calls, client } = fake();
    const tapped = { ...OLD, id: "t1", confirmed: false };
    const row = await keepRecent(client, [tapped], place({ lat: OLD.lat + 40 * M }), true);
    expect(calls.map((c) => [c.op, c.id, c.row.confirmed])).toEqual([["update", "t1", true]]);
    expect(row).toMatchObject({ id: "t1", confirmed: true });
  });
  it("a tap on a row that is already confirmed keeps it confirmed", async () => {
    const { calls, client } = fake();
    await keepRecent(client, [OLD], place(), false);
    expect(calls[0].row.confirmed).toBe(true);
  });
  it("the same name within 50 m of an older recent uses that row again: one update on its id, no insert", async () => {
    const { calls, client } = fake();
    const row = await keepRecent(client, [OLD], place({ lat: OLD.lat + 40 * M }));
    expect(calls.map((c) => [c.op, c.id])).toEqual([["update", "r1"]]);
    expect(calls[0].row).toMatchObject({ address: "Flat 2, Sample Nagar", house: "Flat 2" });   // the row takes the new words
    expect(row).toMatchObject({ id: "r1", house: "Flat 2" });
  });
  it("the same name 60 m away is a new row", async () => {
    const { calls, client } = fake();
    const row = await keepRecent(client, [OLD], place({ lat: OLD.lat + 60 * M }));
    expect(calls.map((c) => c.op)).toEqual(["insert"]);
    expect(row?.id).toBe("new");
  });
  it("another name at the same point is a new row", async () => {
    const { calls, client } = fake();
    await keepRecent(client, [OLD], place({ name: "Example Market" }));
    expect(calls.map((c) => c.op)).toEqual(["insert"]);
  });
  it("no postal code, so no recent: nothing is written", async () => {
    const { calls, client } = fake();
    expect(await keepRecent(client, [OLD], place({ pin: "" }))).toBeNull();   // an older recent at the same place is not touched either
    expect(await keepRecent(client, [], place({ pin: "", name: "Example Market" }))).toBeNull();
    expect(calls).toEqual([]);
  });
});
