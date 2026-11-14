// Story 1530: what a recent holds. Only the customer's own words and rows of our own postal code table; never an answer of Ola (search row or address lookup).
import { describe, expect, it } from "vitest";
import { recentWords } from "../../src/lib/recents";

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
    expect(recentWords("green park", hit("ola"), { house: "12B", landmark: "", area: "Gali 3, Radio Colony" }).address).toBe("12B, Gali 3, Radio Colony");
  });
  it("long words are cut to what the table takes", () => {
    const w = recentWords("x".repeat(200), hit("ola"), { house: "h".repeat(120), landmark: "l".repeat(120), area: "a".repeat(200) });
    expect(w.name.length).toBe(80);
    expect(w.address.length).toBeLessThanOrEqual(300);
  });
});
