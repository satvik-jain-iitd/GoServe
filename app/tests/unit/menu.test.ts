// Story #48, S2: the menu still shows when the network is off, after it was loaded once.
import { describe, expect, it } from "vitest";
import { loadMenu, MENU_KEY } from "../../src/lib/menu";

const dishes = [{ id: "a", name: "Butter Chicken", price_paise: 32000, image_url: "u", image_credit: "c" }];
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("loadMenu", () => {
  it("returns the fresh menu and keeps a copy", async () => {
    const storage = memory();
    const r = await loadMenu(async () => dishes, storage);
    expect(r).toEqual({ dishes, fromCache: false });
    expect(JSON.parse(storage.getItem(MENU_KEY)!)).toEqual(dishes);
  });

  it("falls back to the copy when the network fails", async () => {
    const storage = memory();
    await loadMenu(async () => dishes, storage);
    const r = await loadMenu(async () => { throw new Error("offline"); }, storage);
    expect(r).toEqual({ dishes, fromCache: true });
  });

  it("fails clearly when there is no network and no copy", async () => {
    await expect(loadMenu(async () => { throw new Error("offline"); }, memory())).rejects.toThrow("No internet. Check your internet and try again.");
  });

  it("does not trust a broken copy", async () => {
    const storage = memory();
    storage.setItem(MENU_KEY, "{not json");
    await expect(loadMenu(async () => { throw new Error("offline"); }, storage)).rejects.toThrow(/No internet/);
  });

  it("does not replace a good copy with an empty menu", async () => {
    const storage = memory();
    await loadMenu(async () => dishes, storage);
    const r = await loadMenu(async () => [], storage);
    expect(r).toEqual({ dishes, fromCache: true });
  });
});
