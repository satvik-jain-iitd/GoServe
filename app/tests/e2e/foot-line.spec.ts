// Story 1697: a flat line above the foot (.ui-bottom), the same line as the tab bar, the full screen width, on the page's own background.
// No button moves. An empty foot shows no line. Measured in a real browser at two phone sizes, one screen of each app. Made-up data only.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
type Box = { x: number; y: number; w: number; h: number };
// The boxes of the foot's buttons measured on the OLD css (before this story), key = "<app> <width>".
const BEFORE: Record<string, Box[]> = {
  "customer 360": [{ x: 20, y: 560, w: 320, h: 56 }],
  "kitchen 360": [{ x: 20, y: 560, w: 320, h: 56 }],
  "rider 360": [{ x: 20, y: 495, w: 320, h: 56 }],
  "admin 360": [{ x: 20, y: 496, w: 320, h: 56 }, { x: 20, y: 560, w: 320, h: 56 }],
  "customer 390": [{ x: 20, y: 764, w: 350, h: 56 }],
  "kitchen 390": [{ x: 20, y: 764, w: 350, h: 56 }],
  "rider 390": [{ x: 20, y: 699, w: 350, h: 56 }],
  "admin 390": [{ x: 20, y: 700, w: 350, h: 56 }, { x: 20, y: 764, w: 350, h: 56 }],
};

const KITCHEN = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const OFF = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016"], open: false, active: false, opens_at: "11:00:00", closes_at: "22:00:00" };

const APPS: Record<string, (context: BrowserContext, page: Page) => Promise<void>> = {
  customer: async (context, page) => { await setup(context, page, [order("placed")]); await page.goto("/customer/"); await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible(); },
  kitchen: async (context, page) => {
    const net = await setup(context, page, [order("accepted")]);
    net.state.kitchen = "k-1";
    await page.goto("/kitchen/");
    await page.getByRole("button", { name: "Cooking", exact: true }).click();
    await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
    await expect(page.locator(".ui-bottom button")).toHaveText("Start");
  },
  rider: async (context, page) => {
    const net = await setup(context, page, [{ ...order("ready", new Date().toISOString(), new Date().toISOString()), id: ID, rider_id: SESSION, customer_name: "Customer 1", address: "House 1, Lajpat Nagar II" }]);
    net.state.kitchens = KITCHEN;
    await page.goto("/rider/");
    await expect(page.locator(".ui-bottom button")).toHaveText(["Picked up"]);
  },
  admin: async (context, page) => {
    const net = await setup(context, page);
    net.state.admin = true;
    net.state.kitchens = [OFF];
    await page.goto("/admin/");
    await page.getByRole("button", { name: "City", exact: true }).click();
    await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
    await expect(page.getByRole("button", { name: "Turn kitchen back on" })).toBeVisible();
  },
};

const read = (page: Page) => page.evaluate(() => {
  const foot = document.querySelector(".ui-bottom") as HTMLElement;
  const s = getComputedStyle(foot), r = foot.getBoundingClientRect();
  const probe = document.createElement("i"); probe.style.borderTopColor = "var(--md-outline-variant)"; probe.style.borderTopStyle = "solid"; document.body.append(probe);
  const line = getComputedStyle(probe).borderTopColor; probe.remove();
  let up: HTMLElement | null = foot.parentElement, behind = "";
  while (up && !behind) { const c = getComputedStyle(up).backgroundColor; if (c !== "rgba(0, 0, 0, 0)" && c !== "transparent") behind = c; up = up.parentElement; }
  return {
    width: s.borderTopWidth, style: s.borderTopStyle, color: s.borderTopColor, line, bg: s.backgroundColor, behind,
    x: r.x, w: r.width, vw: document.documentElement.clientWidth,
    buttons: [...foot.querySelectorAll("button, a")].map((b) => { const q = b.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }),
  };
});

for (const size of SIZES) {
  for (const app of Object.keys(APPS)) {
    test(`${app} at ${size.width} by ${size.height}: a 1 px line in the tab bar's colour, full width, the page's own background, buttons unmoved`, async ({ page, context }) => {
      await page.setViewportSize(size);
      await APPS[app](context, page);
      const m = await read(page);
      expect(m.width).toBe("1px");
      expect(m.style).toBe("solid");
      expect(m.color).toBe(m.line);
      expect(m.x).toBe(0);
      expect(m.w).toBe(size.width);
      expect(m.bg).not.toBe("rgba(0, 0, 0, 0)");
      expect(m.bg).toMatch(/^rgb\(/);   // alpha 1
      expect(m.bg).toBe(m.behind);
      const before = BEFORE[`${app} ${size.width}`];
      expect(before, "the before boxes are filled in").toBeTruthy();
      expect(m.buttons.length).toBe(before.length);
      m.buttons.forEach((b, i) => { for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(b[k] - before[i][k])).toBeLessThanOrEqual(0.5); });
    });
  }
  test(`customer at ${size.width} by ${size.height}: a foot with no button shows no line`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await setup(context, page, [order("preparing")]);
    await page.goto("/customer/");
    await expect(page.getByRole("region", { name: /^Order/ }).first()).toBeVisible();
    const foot = page.locator(".ui-bottom");
    await expect(foot).toHaveCount(1);
    await expect(foot.locator("*")).toHaveCount(0);
    expect(await foot.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("0px");
  });
}
