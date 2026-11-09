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

  // Story #930: the banner said "No connection" while the phone was online, because a 4 second timeout counted as "offline".
  const slow = () => new Error("The operation was aborted due to timeout");
  const seeded = async () => { const st = memory(); await loadMenu(async () => dishes, st); return st; };

  it("S1 a timeout with a saved copy shows the copy with no banner, re-reads, and the fresh menu lands with fromCache false", async () => {
    const storage = await seeded();
    const fresh = [{ ...dishes[0], price_paise: 33000 }];
    let n = 0;
    const later: { dishes: unknown[]; fromCache: boolean }[] = [];
    const r = await loadMenu(async () => { if (++n === 1) throw slow(); return fresh; }, storage, MENU_KEY, { onLater: (m) => later.push(m), delayMs: 0 });
    expect(r).toEqual({ dishes, fromCache: false });   // the saved copy, silently
    await new Promise((res) => setTimeout(res, 20));
    expect(later).toEqual([{ dishes: fresh, fromCache: false }]);
    expect(n).toBe(2);
  });

  it("S2 two reads in a row failing show the banner", async () => {
    const storage = await seeded();
    const later: { dishes: unknown[]; fromCache: boolean }[] = [];
    await loadMenu(async () => { throw slow(); }, storage, MENU_KEY, { onLater: (m) => later.push(m), delayMs: 0 });
    await new Promise((res) => setTimeout(res, 20));
    expect(later).toEqual([{ dishes, fromCache: true, slow: true }]);   // online but two reads failed: the banner says slow, not "no connection"
  });

  it("S3 a phone that is offline shows the banner at once and does not re-read", async () => {
    const storage = await seeded();
    let n = 0;
    const r = await loadMenu(async () => { n++; throw new Error("offline"); }, storage, MENU_KEY, { delayMs: 0 });
    expect(r).toEqual({ dishes, fromCache: true });
    expect(n).toBe(1);
  });

  it("S4 with no saved copy a first timeout is read again before the screen says it failed", async () => {
    let n = 0;
    const r = await loadMenu(async () => { if (++n === 1) throw slow(); return dishes; }, memory(), MENU_KEY, { delayMs: 0 });
    expect(r).toEqual({ dishes, fromCache: false });
  });

  it("fails clearly when there is no network and no copy", async () => {
    await expect(loadMenu(async () => { throw new Error("offline"); }, memory())).rejects.toThrow("No internet. Check your internet and try again.");
  });

  it("does not trust a broken copy", async () => {
    const storage = memory();
    storage.setItem(MENU_KEY, "{not json");
    await expect(loadMenu(async () => { throw new Error("offline"); }, storage)).rejects.toThrow(/No internet/);
  });

  it("an empty answer with nothing saved is a real answer, not a miss (story #891)", async () => {
    const r = await loadMenu(async () => [], memory());
    expect(r).toEqual({ dishes: [], fromCache: false });
  });

  it("does not replace a good copy with an empty menu", async () => {
    const storage = memory();
    await loadMenu(async () => dishes, storage);
    const r = await loadMenu(async () => [], storage);
    expect(r).toEqual({ dishes, fromCache: true });
  });
});
