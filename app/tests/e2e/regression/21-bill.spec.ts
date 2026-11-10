// Regression, screen 21: D1 Bill. Cases: .claude/handoff/qa/screens/21-D1.md (epic #1196, story #1197). Reached with the shared step STEPS["bill"] (one Butter Chicken on the bill).
// Where a case needs data the shared step does not hold (a quote with fees, a dish sold out, a dropped network on Place order), the test answers the same REST or function
// paths again after the step (a later route wins). Cases 21.2 to 21.8 fill the details the same way the phone would.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
const ADDRESS = "C-128, Green Avenue Colony, Satai Road, Chhatarpur 471001";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
test.use({ viewport: { width: 390, height: 844 } });

const dish = (id: string, name: string, price_paise: number, available: boolean) =>
  ({ id, name, price_paise, image_url: null, image_credit: null, veg: false, category: "Mains", available });
const isPath = (path: string) => (url: URL) => url.pathname === path;
// Answers a REST read (and the browser's preflight); any write goes to the shared step's own answer.
async function answer(route: Route, body: unknown) {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  if (req.method() !== "GET") return route.fallback();
  return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
}
const place = (page: Page) => page.getByRole("button", { name: /Place order/ });
const nameBox = (page: Page) => page.getByRole("textbox", { name: "Your name", exact: true });
const phoneBox = (page: Page) => page.getByRole("textbox", { name: "Phone", exact: true });
const addressBox = (page: Page) => page.getByRole("textbox", { name: "Address", exact: true });
const noteBox = (page: Page) => page.getByRole("textbox", { name: "Note for the kitchen (optional)", exact: true });
async function fillDetails(page: Page) {
  await nameBox(page).fill("Amit Kumar");
  await phoneBox(page).fill("9876543210");
  await addressBox(page).fill(ADDRESS);
}
// The row of the slip with this label: its last span holds the amount.
const slipAmount = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("..").locator("span").last();
const rupees = (text: string) => Number(text.replace(/[^\d]/g, ""));

test("TC 21.1 Look: the kitchen and pin, the one line, Delivery, Cash at door, Add more, the four fields, How you pay, the sticky Place order", async ({ page, context }) => {
  await STEPS["bill"](context, page, PATH);
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();   // proves the bill shows before the parts are checked
  await expect(page.getByText("Hauz Khas Kitchen · 110016", { exact: true })).toBeVisible();
  await expect(page.getByText("1 × Butter Chicken", { exact: true })).toBeVisible();
  await expect(page.getByText("320", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivery", { exact: true })).toBeVisible();
  await expect(page.getByText("Free", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash at door", { exact: true })).toBeVisible();
  await expect(page.getByText("₹320", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add more" })).toBeVisible();
  await expect(nameBox(page)).toBeVisible();
  await expect(phoneBox(page)).toBeVisible();
  await expect(addressBox(page)).toHaveAttribute("placeholder", "e.g. C-128, Green Avenue Colony");
  await expect(noteBox(page)).toHaveAttribute("placeholder", "e.g. less spicy, no onion");
  await expect(page.getByText("0 / 200", { exact: true })).toBeVisible();
  const pay = page.getByRole("radiogroup", { name: "How you pay" });
  await expect(pay).toBeVisible();
  await expect(pay.getByText("Cash on delivery", { exact: true })).toBeVisible();
  await expect(pay.getByText("UPI", { exact: true })).toBeVisible();
  await expect(pay.getByText("Card", { exact: true })).toBeVisible();
  await expect(place(page)).toContainText("Cash · ₹320");
  await expect(place(page)).toContainText("Place order ›");
});

test("TC 21.2 Address empty: Place order is grey and a reason line names the address", async ({ page, context }) => {
  await STEPS["bill"](context, page, PATH);
  await expect(addressBox(page)).toHaveValue("");
  await expect(place(page)).toBeVisible();   // proves the button shows before its state is checked
  await expect(page.getByRole("status").filter({ hasText: "Add your address to place the order." })).toBeVisible();
  await expect(place(page)).toBeDisabled();
  await expect(place(page)).toHaveCSS("background-color", "rgb(220, 223, 214)");   // #DCDFD6
  await expect(place(page)).toHaveCSS("color", "rgb(79, 90, 80)");   // #4F5A50
});

test("TC 21.3 Fill all, Place order: the Order placed screen opens", async ({ page, context }) => {
  await STEPS["bill"](context, page, PATH);
  await fillDetails(page);
  await expect(place(page)).toBeEnabled();   // proves the button is on before it is pressed
  await place(page).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
});

test("TC 21.4 Note over 200 letters: it stops at 200 and the counter reads 200 / 200", async ({ page, context }) => {
  await STEPS["bill"](context, page, PATH);
  await noteBox(page).fill("less spicy");
  await expect(page.getByText("10 / 200", { exact: true })).toBeVisible();   // the counter is live before the long note
  await noteBox(page).fill("n".repeat(230));
  await expect(page.getByText("200 / 200", { exact: true })).toBeVisible();
  await expect(noteBox(page)).toHaveValue("n".repeat(200));
});

test("TC 21.5 Tap Place order twice fast: one order, not two", async ({ page, context }) => {
  const sent: string[] = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/functions/v1/orders")) sent.push(r.url()); });
  await STEPS["bill"](context, page, PATH);
  await fillDetails(page);
  await expect(place(page)).toBeEnabled();
  await place(page).dblclick();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(sent).toHaveLength(1);   // one order request left the phone
});

test("TC 21.6 A dish sells out on the bill: the line is struck through, Swap it in or Take it out is offered", async ({ page, context }) => {
  await STEPS["bill"](context, page, PATH);
  await expect(page.getByText("1 × Butter Chicken", { exact: true })).toBeVisible();   // proves the line is there and not struck yet
  await expect(page.getByText("1 × Butter Chicken", { exact: true }).locator("..")).not.toHaveCSS("text-decoration-line", /line-through/);
  // The server's answer for a sold-out dish: it names one alternative.
  await context.route(isPath("/functions/v1/quote"), (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "dish_sold_out", message: "Butter Chicken is sold out.", alternative: { menu_item_id: "d9", name: "Dal Makhani", price_paise: 22000, discount_paise: 2200 } }) });
  });
  // The menu now says the dish is sold out; the bill reads it when the page starts again with the same cart.
  await context.route(isPath("/rest/v1/menu_items"), (r) => answer(r, [dish("d1", "Butter Chicken", 32000, false)]));
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "Butter Chicken is sold out." })).toBeVisible();
  await expect(page.getByText("1 × Butter Chicken", { exact: true }).locator("..")).toHaveCSS("text-decoration-line", /line-through/);
  await expect(page.getByRole("button", { name: "Swap it in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Take it out" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fix the bill first/ })).toBeDisabled();
});

test("TC 21.7 No network on Place order: our own line shows, and the order is not sent twice when the network comes back", async ({ page, context }) => {
  let down = true;
  const sent: string[] = [];
  await STEPS["bill"](context, page, PATH);
  // Registered after the shared step, so this answer wins over the step's own order answer.
  await context.route("https://test.supabase.co/functions/v1/orders", (route) => {
    if (route.request().method() === "POST") sent.push(route.request().postData() ?? "");
    if (down) return route.abort();   // no network: the phone never reaches the server
    return route.fallback();          // the network is back: the shared answer places the order
  });
  await fillDetails(page);
  await place(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "No internet. Check your internet and try again." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();   // still on the bill, nothing lost
  await expect(nameBox(page)).toHaveValue("Amit Kumar");
  down = false;
  await place(page).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  const keys = new Set(sent.map((body) => JSON.parse(body).idempotency_key));
  expect(sent).toHaveLength(2);   // the failed try and the retry
  expect(keys.size).toBe(1);      // the same order key both times, so the server can never make two orders
});

test("TC 21.8 Bill total: the total equals the lines plus the fees", async ({ page, context }) => {
  await STEPS["bill"](context, page, PATH);
  // The server's priced bill: one line at 320, delivery 40, packaging 10. Registered after the shared step, then the page starts again so the bill asks for it.
  await context.route(isPath("/functions/v1/quote"), (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({
      ok: true, item_total_paise: 32000, fees: { delivery_paise: 4000, packaging_paise: 1000, total_paise: 5000 }, discount_paise: 0, coupon: null,
      tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 37000, offers: [],
    }) });
  });
  await page.reload();
  await expect(page.getByText("To pay", { exact: true })).toBeVisible();   // proves the server's bill is on the screen
  await expect(slipAmount(page, "Delivery")).toHaveText("40");
  await expect(slipAmount(page, "Packaging")).toHaveText("10");
  const lines = rupees(await slipAmount(page, "1 × Butter Chicken").innerText());
  const fees = rupees(await slipAmount(page, "Delivery").innerText()) + rupees(await slipAmount(page, "Packaging").innerText());
  const total = rupees(await page.getByText("To pay", { exact: true }).locator("..").locator("span").last().innerText());
  expect(lines).toBe(320);
  expect(total).toBe(lines + fees);
  expect(total).toBe(370);
});
