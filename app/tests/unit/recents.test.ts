// Story 1530: what a recent holds. Only the customer's own words and rows of our own postal code table; never an answer of Ola (search row or address lookup).
import { describe, expect, it } from "vitest";
import { keepRecent, listRecents, recentWords, type Recent } from "../../src/lib/recents";

const hit = (from?: "ola" | "own") => ({ name: "Olaname Market", address: "Olaname Market, Olatown", lat: 1, lng: 2, pin: "110016", served: true, from });
const typed = { house: " 12B ", landmark: "near park gate", area: "" };

describe("recentWords", () => {
  it("a tapped Ola row: its name and address are kept (owner, 17 Nov 2026; loan: undo recent_drop_ola())", () => {
    const w = recentWords("  green park ", hit("ola"), typed);
    expect(w).toEqual({ name: "Olaname Market", address: "12B, near park gate, Olaname Market, Olatown" });
  });
  it("a row with no source uses the tapped result's name too", () => {
    expect(recentWords("green park", hit(), typed).name).toBe("Olaname Market");
  });
  it("a row of our own postal code table is kept as it is", () => {
    expect(recentWords("olan", hit("own"), typed)).toEqual({ name: "Olaname Market", address: "12B, near park gate, Olaname Market, Olatown" });
  });
  it("the area the customer typed on the details sheet wins over the search words", () => {
    expect(recentWords("green park", hit("ola"), { house: "12B", landmark: "", area: "Gali 3, Example Colony" }).address).toBe("12B, Gali 3, Example Colony");
  });
  it("long words are cut to what the table takes", () => {
    const w = recentWords("x".repeat(200), null, { house: "h".repeat(120), landmark: "l".repeat(120), area: "a".repeat(200) });
    expect(w.name.length).toBe(80);
    expect(w.address.length).toBeLessThanOrEqual(300);
  });
  // Story 1625: a tapped search result keeps its own name and address when the customer's words are short.
  it("U4 a tap on an Ola row: the row's name and address, not the short words typed", () => {
    const w = recentWords("samp", { ...hit("ola"), name: "Sample Junction", address: "Sample Junction, Sample Road" }, { house: "", landmark: "", area: "" });
    expect(w).toEqual({ name: "Sample Junction", address: "Sample Junction, Sample Road" });
  });
  it("U5 a row kept from the list: its name, the house and the area", () => {
    const row: Recent = { ...OLD, id: "r9", name: "Sample Junction", address: "Sample Junction, Sample Road" };
    const w = recentWords(row.name, null, { house: "12B", landmark: "", area: "Gali 3" }, row);
    expect(w.name).toBe("Sample Junction");
    expect(w.address).toContain("12B");
    expect(w.address).toContain("Gali 3");
  });
});

// Story 1540 (the reviewer's ask on story 1530): when a confirmed place takes an older recent, and when it is no recent at all.
type Call = { op: "update" | "insert"; id?: string; row: Record<string, unknown> };
function fake() {   // the two calls keepRecent makes on recent_places, written down
  const calls: Call[] = [];
  const client = { from: () => ({
    update: (row: Record<string, unknown>) => ({ eq: (_col: string, id: string) => { calls.push({ op: "update", id, row }); return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => ({ data: { id, used_at: "2026-11-15T10:00:00Z", ...row }, error: null }) }) }); } }),
    insert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => { calls.push({ op: "insert", row }); return { data: { id: "new", used_at: "2026-11-15T10:00:00Z", ...row }, error: null }; } }) }),
  }) } as unknown as Parameters<typeof keepRecent>[0];
  return { calls, client };
}
const OLD: Recent = { id: "r1", name: "Sample Nagar", address: "Flat 1, Sample Nagar", pin: "110016", lat: 28.57, lng: 77.24, house: "Flat 1", landmark: "", used_at: "2026-11-10T10:00:00Z", confirmed: true, source: null };
const place = (over: Partial<Recent> & { source?: "ola" | "own" | null } = {}) => ({ name: OLD.name, address: "Flat 2, Sample Nagar", pin: "110016", lat: OLD.lat, lng: OLD.lng, house: "Flat 2", landmark: "", source: null, ...over });
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
  it("a confirmed row with no postal code is not written", async () => {
    const { calls, client } = fake();
    expect(await keepRecent(client, [OLD], place({ pin: "" }))).toBeNull();   // an older recent at the same place is not touched either
    expect(await keepRecent(client, [], place({ pin: "", name: "Example Market" }))).toBeNull();
    expect(calls).toEqual([]);
  });
  // Story 1625: a tapped row with no postal code is kept (pin_code null), and a tap with an id updates that row.
  it("U1 a tap with no postal code: one insert with pin_code null, not confirmed, the source as given", async () => {
    const { calls, client } = fake();
    await keepRecent(client, [], place({ pin: "", source: "own" }), false);
    expect(calls.map((c) => [c.op, c.row.pin_code, c.row.confirmed, c.row.source])).toEqual([["insert", null, false, "own"]]);
  });
  it("U3 a tap with an id: one update on that id, no insert, even 300 m from the old row", async () => {
    const { calls, client } = fake();
    await keepRecent(client, [OLD], place({ lat: OLD.lat + 300 * M }), false, "r1");
    expect(calls.map((c) => [c.op, c.id])).toEqual([["update", "r1"]]);
  });
  it("U3b a tap with an id on a confirmed row: the update keeps it confirmed", async () => {
    const { calls, client } = fake();
    await keepRecent(client, [OLD], place(), false, "r1");
    expect(calls[0].row.confirmed).toBe(true);
  });
});

describe("fromRow through listRecents", () => {
  // U6: a row with no postal code reads as pin "" and source null.
  it("U6 pin_code null: pin is an empty string and source is null", async () => {
    const data = [{ id: "n1", name: "Sample Junction", address: "Sample Road", pin_code: null, lat: 1, lng: 2, house: null, landmark: null, used_at: "2026-11-18T10:00:00Z", confirmed: false, source: null }];
    const chain = { select: () => chain, order: () => chain, limit: async () => ({ data, error: null }) };
    const client = { from: () => chain } as unknown as Parameters<typeof listRecents>[0];
    const [r] = await listRecents(client);
    expect(r).toMatchObject({ pin: "", source: null });
  });
});
