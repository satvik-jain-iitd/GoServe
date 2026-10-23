// Story B1 (#157): the customer's unfinished order (screen, cart, address) survives a refresh.
import { describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "../../src/lib/draft";

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
};

describe("draft", () => {
  it("brings back the screen, the cart and the address", () => {
    const s = store();
    saveDraft({ step: "bill", cart: { d1: 2 }, address: "Flat 4", name: "", phone: "" }, s);
    expect(loadDraft(s)).toEqual({ step: "bill", cart: { d1: 2 }, address: "Flat 4", name: "", phone: "" });
  });
  it("starts empty when nothing was saved", () => {
    expect(loadDraft(store())).toEqual({ step: "menu", cart: {}, address: "", name: "", phone: "" });
  });
  it("ignores damaged data instead of breaking the app", () => {
    const s = store();
    s.setItem("gs-draft", "{not json");
    expect(loadDraft(s)).toEqual({ step: "menu", cart: {}, address: "", name: "", phone: "" });
    s.setItem("gs-draft", JSON.stringify({ step: "hack", cart: { d1: "x", d2: -1, d3: 3 }, address: 7 }));
    expect(loadDraft(s)).toEqual({ step: "menu", cart: { d3: 3 }, address: "", name: "", phone: "" });
  });
  it("the tracker screen is saved as the menu, so a refresh resumes the open order instead", () => {
    const s = store();
    saveDraft({ step: "placed", cart: {}, address: "Flat 4", name: "", phone: "" }, s);
    expect(loadDraft(s).step).toBe("menu");
  });
  it("clearDraft forgets everything", () => {
    const s = store();
    saveDraft({ step: "cart", cart: { d1: 1 }, address: "x", name: "", phone: "" }, s);
    clearDraft(s);
    expect(loadDraft(s)).toEqual({ step: "menu", cart: {}, address: "", name: "", phone: "" });
  });
});
