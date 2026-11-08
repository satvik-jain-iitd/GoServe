// Story #1060: the onboarding slip ends 24 px above the bottom of the screen, with its bottom edge showing (boards O0-Welcome, O0b-Code).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

for (const [w, h] of [[390, 844], [375, 667]] as const) {
  for (const door of ["Google only", "phone code"] as const) {
    test(`S1 at ${w}x${h} the slip (${door}) ends at least 24 px above the bottom`, async ({ page, context }) => {
      await page.setViewportSize({ width: w, height: h });
      const net = await setup(context, page, [], { guest: true });
      if (door === "phone code") net.state.otpLogin = true;
      await page.goto("/customer/");
      await expect(page.locator(".ui-welcome .ui-slip, .ui-landing .ui-slip").first()).toBeVisible();
      const slip = await page.locator(".ui-welcome .ui-slip, .ui-landing .ui-slip").first().boundingBox();
      expect(h - (slip!.y + slip!.height)).toBeGreaterThanOrEqual(24);
    });
  }
}
