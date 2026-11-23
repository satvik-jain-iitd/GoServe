// Story 1789: a long rider name never breaks the one line of the customer's rider card.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
  test(`1789 long name stays on one line at ${size.width}x${size.height}`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const net = await setup(context, page, [order("ready", "2020-01-01T10:05:00Z")]);
    net.state.kitchens = KITCHEN;
    net.state.riderCard = { name: "Abcdefghijklmnopqrstuvwxyz Zedmund Quillfeather", phone: "9876500000" };
    await page.goto("/customer/");
    const card = page.getByTestId("rider-card");
    await expect(card).toContainText("is bringing your order");
    await expect(card).toContainText("A.Z.Q.");
    await expect(card).not.toContainText("Abcdefghijklmnopqrstuvwxyz");
    const m = await card.evaluate((el) => { const s = el.querySelector("strong")!; return { h: s.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(s).fontSize), over: s.scrollWidth > s.clientWidth, right: el.getBoundingClientRect().right <= innerWidth }; });
    expect(m.over).toBe(false);
    expect(m.right).toBe(true);
    expect(m.h).toBeLessThan(m.fs * 1.6);   // one line box
  });
}
