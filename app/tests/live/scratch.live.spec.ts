import { test } from "@playwright/test";
test("board", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("file:///tmp/live1/board-o0gb.html");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/live1/board-o0gb.png" });
  const r = await page.evaluate(() => [...document.querySelectorAll("img, button, h2, p")].map((e) => { const b = e.getBoundingClientRect(); return `${e.tagName} ${(e.textContent || "").trim().slice(0, 30)} x=${Math.round(b.x)} y=${Math.round(b.y)} w=${Math.round(b.width)} h=${Math.round(b.height)}`; }));
  console.log(r.join("\n"));
});
