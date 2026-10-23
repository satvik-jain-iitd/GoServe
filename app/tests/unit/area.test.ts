// Story B2 (#158): pin code to kitchen to menu.
import { describe, expect, it } from "vitest";
import { chooseKitchen, isPin, loadPin, savePin, type AreaKitchen } from "../../src/lib/area";
import { MENU_KEY, loadMenu } from "../../src/lib/menu";

const k = (id: string, name: string, pins: string[], over: Partial<AreaKitchen> = {}): AreaKitchen => ({ id, name, pin_codes: pins, lat: null, lng: null, open: true, active: true, ...over });
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
  it("picks the open kitchen that serves the pin code", () => {
    expect(chooseKitchen([k("a", "A", ["110016"]), k("b", "B", ["110001"])], "110016")).toEqual({ kind: "ok", kitchen: expect.objectContaining({ id: "a" }) });
  });
  it("says none when no kitchen serves the pin code", () => {
    expect(chooseKitchen([k("a", "A", ["110016"])], "110099")).toEqual({ kind: "none" });
  });
  it("says closed, with the name, when every kitchen that serves it is closed or inactive", () => {
    expect(chooseKitchen([k("a", "A", ["110016"], { open: false }), k("b", "B", ["110016"], { active: false })], "110016")).toEqual({ kind: "closed", name: "A" });
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
