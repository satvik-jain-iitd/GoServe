// Story #1163 (owner, 9 Nov): the zigzag is gone everywhere, the welcome screens too, and nothing around it moves. .ui-zigzag keeps its 8 px but is hidden; the slip top is a straight edge of the same 8 px.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the zigzag is hidden and keeps its 8 px, and the slip top has no triangle mask", async ({ page, context }) => {
  await setup(context, page, [], { guest: true });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  const z = await page.locator(".ui-zigzag").evaluateAll((els) => els.map((e) => ({ v: getComputedStyle(e).visibility, h: e.getBoundingClientRect().height })));
  for (const x of z) { expect(x.v).toBe("hidden"); expect(Math.round(x.h)).toBe(8); }
  const slip = await page.locator(".ui-slip").first().evaluate((e) => { const s = getComputedStyle(e, "::before"); return { mask: s.maskImage, wmask: s.webkitMaskImage, h: s.height, bw: s.borderTopWidth }; });
  expect(slip.mask).toBe("none");
  expect(slip.wmask).toBe("none");
  expect(slip.h).toBe("8px");
  expect(slip.bw).toBe("1px");
});
