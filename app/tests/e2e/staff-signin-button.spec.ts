// Story 882, boards K-SignIn, R-SignIn and A-SignIn: the staff sign-in screens draw the big, filled, full-width Google button, as the customer welcome does.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

for (const [app, path] of [["kitchen", "/kitchen/"], ["rider", "/rider/"], ["admin", "/admin/"]] as const) {
  test(`S${app === "kitchen" ? 1 : app === "rider" ? 2 : 3} the ${app} sign-in button is filled and as wide as its column`, async ({ page, context }) => {
    const net = await setup(context, page, [], { guest: true });
    net.state.rider = null;   // the rider app opens its sign-in only when this account has no rider row
    await page.goto(path);
    const button = page.getByTestId("google-signin");
    await expect(button).toBeVisible();
    const look = await button.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const p = (el.parentElement as HTMLElement).getBoundingClientRect();
      return { fill: getComputedStyle(el).backgroundColor, width: b.width, column: p.width, height: b.height };
    });
    expect(look.fill, "filled, not transparent").not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(look.width, "as wide as its column").toBeGreaterThanOrEqual(look.column - 1);
    expect(look.height, "a big tap target").toBeGreaterThanOrEqual(56);
  });
}
