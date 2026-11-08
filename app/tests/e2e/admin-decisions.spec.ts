// Story #263 layer 1, changed by story #1068: the admin's Decisions block on the Numbers tab shows Rules only. The database decides; there is no engine to switch and no call from the block.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const open = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "Numbers", exact: true }).click(); };

test("S1 the block shows Rules on and nothing else: no Jev, no Laya, nothing to switch", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await open(page);
  const block = page.getByRole("region", { name: "Decisions" });
  await expect(block.getByRole("radio", { name: /^Rules/ })).toBeChecked();
  await expect(block.getByRole("radio", { name: /^Rules/ })).toBeDisabled();
  await expect(block.getByRole("radio")).toHaveCount(1);
  await expect(block).not.toContainText("Jev");
  await expect(block).not.toContainText("Laya");
  await expect(block.getByTestId("engine-meta")).toHaveCount(0);
  expect(net.calls.engine).toEqual([]);   // no call to n8n
  expect(await axeScan(page)).toEqual([]);
});
