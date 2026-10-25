// Story B2 (#158): pin code to kitchen to menu.
import { describe, expect, it } from "vitest";
import { chooseKitchen, isPin, loadPin, savePin, type AreaKitchen } from "../../src/lib/area";
import { MENU_KEY, loadMenu } from "../../src/lib/menu";

const k = (id: string, name: string, pins: string[], over: Partial<AreaKitchen> = {}): AreaKitchen => ({ id, name, pin_codes: pins, lat: null, lng: null, open: true, active: true, opens_at: null, ...over });
const store = () => {
  const m = new Map<string, string>();
  return { getItem: (x: string) => m.get(x) ?? null, setItem: (x: string, v: string) => void m.set(x, v), removeItem: (x: string) => void m.delete(x) } as Storage;
};

describe("isPin", () => {
  it("is six digits", () => {
    expect(isPin("110016")).toBe(true);
    for (const bad of ["", "1100", "1100167", "11001a", " 110016"]) expect(isPin(bad), bad).toBe(false);
  });
});

describe("chooseKitchen", () => {
  it("#283 a demo kitchen shows on its real pin code, like any other kitchen", () => {   // story #283 (was H5 #188: hidden from real pins)
    const sim: AreaKitchen = { id: "s-1", name: "Saket Rasoi", pin_codes: ["110016", "110017"], lat: null, lng: null, open: true, active: true, synthetic: true };
    expect(chooseKitchen([sim], "110016")).toEqual({ kind: "ok", kitchen: sim });
    expect(chooseKitchen([sim], "110099")).toEqual({ kind: "none" });
  });
  it("picks the open kitchen that serves the pin code", () => {
    expect(chooseKitchen([k("a", "A", ["110016"]), k("b", "B", ["110001"])], "110016")).toEqual({ kind: "ok", kitchen: expect.objectContaining({ id: "a" }) });
  });
  it("says none when no kitchen serves the pin code", () => {
    expect(chooseKitchen([k("a", "A", ["110016"])], "110099")).toEqual({ kind: "none" });
  });
  it("says closed, with the name, when every kitchen that serves it is closed or inactive", () => {
    expect(chooseKitchen([k("a", "A", ["110016"], { open: false }), k("b", "B", ["110016"], { active: false })], "110016")).toEqual({ kind: "closed", id: "a", name: "A", opens_at: null });
  });
  it("with several open kitchens takes the nearest to a place, else the first by name", () => {
    const list = [k("far", "Zed", ["110016"], { lat: 28.9, lng: 77.5 }), k("near", "Beta", ["110016"], { lat: 28.55, lng: 77.2 }), k("noco", "Alpha", ["110016"])];
    expect(chooseKitchen(list, "110016", { lat: 28.5, lng: 77.2 })).toEqual({ kind: "ok", kitchen: expect.objectContaining({ id: "near" }) });
    expect(chooseKitchen(list, "110016")).toEqual({ kind: "ok", kitchen: expect.objectContaining({ id: "noco" }) });
  });
});

describe("pin storage", () => {
  it("keeps the pin code and ignores anything damaged", () => {
    const s = store();
    expect(loadPin(s)).toBeNull();
    savePin("110016", s);
    expect(loadPin(s)).toBe("110016");
    s.setItem("gs-pin", "hack");
    expect(loadPin(s)).toBeNull();
  });
});

describe("loadMenu per kitchen", () => {
  it("keeps one saved copy per kitchen", async () => {
    const s = store();
    const dish = (id: string) => ({ id, name: id, price_paise: 100, image_url: null, image_credit: null });
    await loadMenu(async () => [dish("a1")], s, `${MENU_KEY}.a`);
    await loadMenu(async () => [dish("b1")], s, `${MENU_KEY}.b`);
    const offline = async () => { throw new Error("offline"); };
    expect((await loadMenu(offline, s, `${MENU_KEY}.a`)).dishes[0].id).toBe("a1");
    expect((await loadMenu(offline, s, `${MENU_KEY}.b`)).dishes[0].id).toBe("b1");
  });
});

import { openingText } from "../../src/lib/area";

describe("openingText (story A6)", () => {
  it("says when a closed kitchen opens, in plain am and pm", () => {
    expect(openingText("Hauz Khas Kitchen", "10:00:00")).toBe("Hauz Khas Kitchen is closed right now. It opens at 10:00 am.");
    expect(openingText("Rohini Kitchen", "18:30:00")).toBe("Rohini Kitchen is closed right now. It opens at 6:30 pm.");
    expect(openingText("Rohini Kitchen", "00:00:00")).toBe("Rohini Kitchen is closed right now. It opens at 12:00 am.");
  });
  it("without opening hours it only says closed", () => {
    expect(openingText("Rohini Kitchen", null)).toBe("Rohini Kitchen is closed right now. Please try again later.");
  });
  it("chooseKitchen carries the opening time of a closed kitchen", () => {
    expect(chooseKitchen([k("a", "A", ["110016"], { open: false, opens_at: "10:00:00" })], "110016")).toEqual({ kind: "closed", id: "a", name: "A", opens_at: "10:00:00" });
  });
});

import { closedLine } from "../../src/lib/area";
import { creditLicence, creditLine } from "../../src/lib/menu";

describe("the menu's closed line and the photo credit (story #274)", () => {
  it("says one line, with or without an opening time", () => {
    expect(closedLine("11:00:00")).toBe("Closed now. Opens at 11:00 am. You can look at the menu.");
    expect(closedLine(null)).toBe("Closed now. You can look at the menu.");
  });
  it("drops the File: name from the credit", () => {
    expect(creditLine("File:Butter chicken.jpg, Wikimedia Commons, CC BY-SA 4.0")).toBe("Photo: Wikimedia Commons, CC BY-SA 4.0");
    expect(creditLine("Wikimedia Commons, CC BY-SA 4.0")).toBe("Photo: Wikimedia Commons, CC BY-SA 4.0");
  });
  it("#292 splits a CC BY credit so the licence can link to Creative Commons, and leaves other credits alone", () => {
    expect(creditLicence('"Masala dosa" by Jane Doe, CC BY 2.0')).toEqual({ before: '"Masala dosa" by Jane Doe, ', label: "CC BY 2.0", href: "https://creativecommons.org/licenses/by/2.0/" });
    expect(creditLicence("Jane Doe, CC0")).toBeNull();
    expect(creditLicence("Wikimedia Commons, CC BY-SA 4.0")).toBeNull();
  });
});
