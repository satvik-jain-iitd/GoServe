// Story S-C (#95): delivered by hand, paid by cash. The prompt "Was your order delivered?", the Yes and Not yet answers, and the reminder.
// Times are tiny (set through the place answer) so the test does not wait minutes. The network is answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const now = () => new Date().toISOString();

// Place one order through the screens. The server answer carries the prompt times in minutes (0.01 min = 0.6 s).
async function placeOrder(page: Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Delivery address").fill("Flat 4, Green Park");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone number").fill("9876543210");
  await page.getByRole("button", { name: "Review bill" }).click();
  await page.getByRole("button", { name: "Place order (cash on delivery)" }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}
const prompt = (page: Page) => page.getByText("Was your order delivered?");

test("the bill and the placed screen say cash on delivery", async ({ page, context }) => {
  await setup(context, page);
  await placeOrder(page);
  await expect(page.getByText("About 20 min · cash on delivery")).toBeVisible();
});

test("S1 the prompt comes after the kitchen taps Ready, not before", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.confirmCfg = { confirm_after_ready_min: 0.01, confirm_after_place_min: 5 };
  await placeOrder(page);
  net.push("INSERT", order("placed", now(), now()));
  await expect(page.getByRole("list", { name: "Order progress" })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(prompt(page)).toHaveCount(0);
  net.push("UPDATE", order("ready", now(), now()));
  await expect(page.getByText("Tap Yes when you have it")).toBeVisible({ timeout: 5000 });
  await expect(prompt(page)).toBeVisible({ timeout: 5000 });
});

test("S2 the prompt comes after the place time when nobody touches the order", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.confirmCfg = { confirm_after_ready_min: 3, confirm_after_place_min: 0.03 };
  await placeOrder(page);
  net.push("INSERT", order("placed", now(), now()));
  await expect(prompt(page)).toBeVisible({ timeout: 8000 });
});

test("S3 Yes closes the order: Paid cash, and the server got the Yes once", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.confirmCfg = { confirm_after_ready_min: 3, confirm_after_place_min: 0.03 };
  await placeOrder(page);
  net.push("INSERT", order("ready", now(), now()));
  await expect(prompt(page)).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Yes, I have it" }).click();
  await expect(page.getByText(/Paid: cash · confirmed/)).toBeVisible();
  await expect(prompt(page)).toHaveCount(0);
  expect(net.calls.confirm).toHaveLength(1);
  expect(net.calls.confirm[0].body).toMatchObject({ action: "confirm", order_id: ID });
  expect(net.calls.confirm[0].headers["x-gs-token"]).toBe("demo-token");
});

test("S4 a second Yes is not an error", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.confirmCfg = { confirm_after_ready_min: 3, confirm_after_place_min: 0.03 };
  net.state.confirmDone = true;
  await placeOrder(page);
  net.push("INSERT", order("ready", now(), now()));
  await expect(prompt(page)).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Yes, I have it" }).click();
  await expect(page.getByText(/Paid: cash · confirmed/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("S5 Not yet three times opens the Feedback sheet with Order not delivered", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.confirmCfg = { confirm_after_ready_min: 3, confirm_after_place_min: 0.03 };
  await placeOrder(page);
  net.push("INSERT", order("ready", now(), now()));
  for (let i = 1; i <= 3; i++) {
    await expect(prompt(page)).toBeVisible({ timeout: 10_000 });   // the re-ask time is short in this build (VITE_REASK_MS)
    await page.getByRole("button", { name: "Not yet" }).click();
  }
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveValue("Order not delivered");
  expect(net.calls.confirm).toHaveLength(0);
});

test("a reminder: when the tester allowed notifications the phone shows one when the prompt comes", async ({ page, context }) => {
  await context.addInitScript(() => {
    (window as any).__notes = [];
    class Fake { static permission = "default"; static requestPermission = async () => ((Fake.permission = "granted"), "granted"); constructor(title: string) { (window as any).__notes.push(title); } }
    (window as any).Notification = Fake;
  });
  const net = await setup(context, page);
  net.state.confirmCfg = { confirm_after_ready_min: 3, confirm_after_place_min: 0.03 };
  await placeOrder(page);
  await page.getByRole("button", { name: "Allow a reminder when your order is ready" }).click();
  net.push("INSERT", order("ready", now(), now()));
  await expect(prompt(page)).toBeVisible({ timeout: 8000 });
  expect(await page.evaluate(() => (window as any).__notes)).toEqual(["Was your order delivered?"]);
});

test("S6 a double tap on a kitchen step: the second answer already_done is not shown as an error", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  net.state.reply = { status: 409, body: { ok: false, error: "already_done", message: "Already done." } };
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByText("Already done.")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
