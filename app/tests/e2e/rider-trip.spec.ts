// Story 1441, layer 1 (boards RP3, RT1, RT2; owner, 13 Nov 2026: "tick wala tareeka karte hain bro"): one trip, many packets.
// One order alone: board RP3, the order number big, its dishes, one button "Picked up". Many: each packet is ticked; "Picked up all N" waits for every tick.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const at = (min: number) => new Date(Date.now() - (60 - min) * 60_000).toISOString();
const IDS = [ID, "0a0a0a0a-1111-4222-8333-444444444444", "0b0b0b0b-1111-4222-8333-444444444444", "0c0c0c0c-1111-4222-8333-444444444444"];
const packet = (i: number, status = "ready") => ({ ...order(status, NOW, at(i)), id: IDS[i], rider_id: SESSION, customer_name: `Customer ${i + 1}`, address: `House ${i + 1}, Lajpat Nagar II` });
const open = async (context: BrowserContext, page: Page, orders: object[]) => {
  const net = await setup(context, page, orders);
  net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
  await page.goto("/rider/");
  return net;
};
const tick = (page: Page, i: number) => page.getByRole("checkbox", { name: new RegExp(IDS[i].slice(0, 8)) });
const all = (page: Page, n: number) => page.getByRole("button", { name: `Picked up all ${n}` });

test("RP3 one order alone: Pick up, Ready, the order number big with its dishes, where it goes, one button Picked up, and no tick", async ({ page, context }) => {
  await open(context, page, [packet(0)]);
  await expect(page.getByRole("heading", { name: "Pick up" })).toBeVisible();
  await expect(page.locator(".ui-head .meta")).toHaveText("Ready");
  const slip = page.getByRole("region", { name: `Pick up order ${ID.slice(0, 8)}` });
  await expect(slip.getByText("Order number")).toBeVisible();
  await expect(slip.locator(".ui-pick-no")).toHaveText(ID.slice(0, 8));
  await expect(slip).toContainText("2 × Butter Chicken");
  await expect(slip).toContainText("House 1, Lajpat Nagar II");
  await expect(slip).not.toContainText("Tau Ka Dhaba");
  await expect(page.locator(".ui-bottom button")).toHaveText(["Picked up"]);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("RT1 a trip of 4 packets with 2 ticked: Picked up all 4 is off and the line says 2 are left; all 4 ticked turns it on", async ({ page, context }) => {
  await open(context, page, [0, 1, 2, 3].map((i) => packet(i)));
  await expect(page.getByText("This trip · 4 packets")).toBeVisible();
  await expect(all(page, 4)).toBeDisabled();
  await tick(page, 0).click();
  await tick(page, 1).click();
  await expect(tick(page, 0)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("2 packet baaki · thaile me rakh kar tick karein")).toBeVisible();
  await expect(all(page, 4)).toBeDisabled();
  await tick(page, 2).click();
  await tick(page, 3).click();
  await expect(all(page, 4)).toBeEnabled();   // board RT2
  await expect(page.getByText(/packet baaki/)).toHaveCount(0);
  await tick(page, 3).click();   // a tick can be taken back
  await expect(all(page, 4)).toBeDisabled();
});

test("RT2 Picked up all 3 picks up each packet once, then the first door shows and the rest wait", async ({ page, context }) => {
  const net = await open(context, page, [0, 1, 2].map((i) => packet(i)));
  for (const i of [0, 1, 2]) await tick(page, i).click();
  await all(page, 3).click();
  await expect(page.getByRole("heading", { name: "On the way" })).toBeVisible();
  await expect.poll(() => net.calls.status.map((c) => c.body)).toEqual(IDS.slice(0, 3).map((id) => ({ order_id: id, action: "pickup" })));   // one save each, in turn
  await expect(page.getByText("2 more waiting")).toBeVisible();
});

test("RT3 a trip of three on the way: Delivered at the first door delivers only that order, and the next door shows", async ({ page, context }) => {
  const net = await open(context, page, [0, 1, 2].map((i) => packet(i, "out_for_delivery")));
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: /^Collect ₹/ }).click();
  await page.getByRole("button", { name: /^Took cash/ }).click();
  expect(net.calls.status.filter((c) => c.body.action === "deliver").map((c) => c.body.order_id)).toEqual([ID]);
  await page.getByRole("button", { name: "Next delivery" }).click();
  await expect(page.getByText("Customer 2")).toBeVisible();
  await expect(page.getByText("1 more waiting")).toBeVisible();
});

// Review of PR 1469 (13 Nov 2026).
test("RT4 a trip of 3, the second pickup fails: the third is not sent, the error shows, and the screen stays on Pick up with that packet", async ({ page, context }) => {
  const net = await open(context, page, [0, 1, 2].map((i) => packet(i)));
  let n = 0;
  await page.route("**/functions/v1/order-actions", async (route) => {
    if (route.request().method() === "POST" && ++n === 2) return route.fulfill({ status: 409, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify({ ok: false, error: "illegal_step", message: "That step is not allowed now." }) });
    return route.fallback();
  });
  for (const i of [0, 1, 2]) await tick(page, i).click();
  await all(page, 3).click();
  await expect(page.getByRole("alert")).toHaveText("That step is not allowed now.");
  expect(net.calls.status.map((c) => c.body.order_id)).toEqual([IDS[0]]);   // the failed one never reached the mock; the third was not sent
  await expect(page.getByRole("heading", { name: "Pick up" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "On the way" })).toHaveCount(0);
  await expect(page.getByText(IDS[1].slice(0, 8), { exact: true })).toBeVisible();
});

test("RT5 a trip on the way: Could not deliver? at the second door marks only that order, and the third door shows", async ({ page, context }) => {
  const net = await open(context, page, [{ ...packet(0, "delivered"), delivered_at: NOW }, packet(1, "out_for_delivery"), packet(2, "out_for_delivery")]);
  page.on("dialog", (d) => void d.accept());
  await expect(page.getByText("Customer 2")).toBeVisible();
  await page.getByRole("button", { name: "Could not deliver?" }).click();
  await expect(page.getByText("Customer 3")).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "rider_refused").map((c) => c.body)).toEqual([{ p_order: IDS[1] }]);
  expect(net.calls.status).toEqual([]);
});
