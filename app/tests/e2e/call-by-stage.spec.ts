// Stories 1656 and 1657 (owner, 20 Nov 2026, frame j3one): one call button in the foot by stage, and a rider card that is one line with no button.
// Placed, accepted, cooking: Call the kitchen. Ready with no rider: Call the kitchen. Ready with a rider, and on the way: Call the rider (always, never "Call <name>").
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const KITCHEN = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
const LONG = "Abcdefghijklmnopqrstuvwxyz";   // 26 letters
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const kitchen = (page: Page) => page.getByRole("link", { name: "Call the kitchen" });
const rider = (page: Page) => page.getByRole("link", { name: "Call the rider" });
const card = (page: Page) => page.getByTestId("rider-card");

async function open(context: BrowserContext, page: Page, status: string, riderCard: { name: string; phone: string } | null = null) {
  const net = await setup(context, page, [order(status, "2020-01-01T10:05:00Z")]);
  net.state.kitchens = KITCHEN;
  if (riderCard) net.state.riderCard = riderCard;
  await page.goto("/customer/");
  await expect(page.getByRole("region", { name: /^Order/ }).first()).toBeVisible();
  return net;
}

for (const status of ["placed", "accepted", "preparing"]) {
  test(`1656 AC-1 ${status}: the foot shows Call the kitchen and no rider call`, async ({ page, context }) => {
    await open(context, page, status);
    await expect(kitchen(page)).toHaveAttribute("href", "tel:9876543210");
    await expect(rider(page)).toHaveCount(0);
  });
}

test("1656 AC-2 ready with no rider: Call the kitchen", async ({ page, context }) => {
  await open(context, page, "ready");
  await expect(kitchen(page)).toBeVisible();
  await expect(rider(page)).toHaveCount(0);
});

test("1656 AC-3 ready with a rider: Call the rider with the rider's phone, and no Call the kitchen", async ({ page, context }) => {
  await open(context, page, "ready", { name: "Ravi", phone: "9876500000" });
  await expect(card(page)).toBeVisible();
  await expect(rider(page)).toHaveAttribute("href", "tel:9876500000");
  await expect(kitchen(page)).toHaveCount(0);
});

test("1657 the foot Call the rider keeps the counted tap: one customer.call for the order", async ({ page, context }) => {
  const net = await open(context, page, "ready", { name: "Ravi", phone: "9876500000" });
  await rider(page).click({ noWaitAfter: true }).catch(() => {});   // tel: has no page to open
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "customer_call").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "customer_call")!.body).toEqual({ p_order: ID });
});

for (const size of SIZES) {
  test(`1656 AC-4 and 1657 AC-1..3 at ${size.width} by ${size.height}: the foot button has one box and the card is one line, and a long name shows as initials (story 1789)`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const net = await open(context, page, "ready");
    const kitchenBox = (await kitchen(page).boundingBox())!;
    const read = async () => ({
      foot: (await rider(page).boundingBox())!,
      card: (await card(page).boundingBox())!,
      text: ((await card(page).textContent()) ?? "").replace(/\s+/g, " ").trim(),
      links: await card(page).locator("a, button").count(),
      cut: await card(page).evaluate((e) => { const s = e.querySelector("strong")!; return { over: s.scrollWidth > s.clientWidth, ellipsis: getComputedStyle(s).textOverflow, oneLine: s.getBoundingClientRect().height < 1.6 * parseFloat(getComputedStyle(s).fontSize), right: e.getBoundingClientRect().right <= innerWidth }; }),
    });
    net.state.riderCard = { name: "Ravi", phone: "9876500000" };
    await page.reload();
    await expect(card(page)).toBeVisible();
    const short = await read();
    net.state.riderCard = { name: LONG, phone: "9876500000" };
    await page.reload();
    await expect(card(page)).toContainText("is bringing your order.");
    const long = await read();
    expect(short.text).toBe("Ravi is bringing your order.");
    expect(short.links).toBe(0);                                  // 1657 AC-2
    expect(long.links).toBe(0);
    expect(long.card.height).toBe(short.card.height);             // 1657 AC-1 one line high for both
    expect(long.cut.oneLine && short.cut.oneLine).toBe(true);
    expect(long.cut.over).toBe(false);                            // story 1789: a long name is shortened to initials, so nothing is cut
    expect(long.cut.right).toBe(true);
    expect(long.text).toBe("A. is bringing your order.");        // story 1789: one 26-letter word gives its initial with a dot, the words after it stay
    for (const k of ["x", "y", "width", "height"] as const) {      // 1657 AC-3 and 1656 AC-4: the foot button box is the same for both names and for the kitchen button
      expect(Math.abs(long.foot[k] - short.foot[k])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(short.foot[k] - kitchenBox[k])).toBeLessThanOrEqual(0.5);
    }
  });
}

test("1657 AC-4 a rider with no name: Your rider is bringing your order.", async ({ page, context }) => {
  await open(context, page, "ready", { name: "", phone: "9876500000" });
  await expect(card(page)).toHaveText("Your rider is bringing your order.");
});

test("1657 on the way with no live place: the foot says Call the rider and the card has no button; at the door the line stays", async ({ page, context }) => {
  const net = await open(context, page, "out_for_delivery", { name: "Ravi Kumar", phone: "9876500000" });
  await expect(card(page)).toHaveText("Ravi is bringing your order.")   // story 1789: the first name;
  await expect(rider(page)).toHaveAttribute("href", "tel:9876500000");
  await expect(page.getByRole("link", { name: /^Call Ravi/ })).toHaveCount(0);
  const arriving = { id: "e1", order_id: ID, event: "order.arriving" };
  net.state.events = [arriving];
  net.push("INSERT", arriving, "order_events");
  await expect(card(page)).toHaveText("Ravi is at your door.", { timeout: 3000 });
  await expect(card(page).locator("a, button")).toHaveCount(0);
});
