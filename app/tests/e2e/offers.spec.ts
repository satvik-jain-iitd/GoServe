// Story #588: the offers on the Bill. Boards C1 (Offers block) and C2 (a code typed). POST /quote is answered by the test; the order is still placed by the v1 path.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const FLAT50 = { code: "FLAT50", title: "Rs 50 off", saves_paise: 5000 };
const WELCOME10 = { code: "WELCOME10", title: "10% off your first order", saves_paise: 3000 };
const bill = (coupon: { code: string; title: string } | null, discount: number, offers: object[]) => ({
  ok: true, kitchen_id: "k-1", lines: [], item_total_paise: 32000, fees: { delivery_paise: 4000, packaging_paise: 0, total_paise: 4000 },
  discount_paise: discount, coupon, tax_paise: 0, tax_mode: "inclusive", to_pay_paise: 36000 - discount, saved_paise: discount, offers,
});
type Seen = { bodies: any[]; auth: string[] };

async function withQuote(context: BrowserContext, page: Page, answer: (body: any) => { status: number; body: unknown }) {
  await setup(context, page);
  const seen: Seen = { bodies: [], auth: [] };
  await context.route("https://test.supabase.co/functions/v1/quote", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    seen.bodies.push(body);
    seen.auth.push(req.headers()["authorization"] ?? "");
    const a = answer(body);
    return route.fulfill({ status: a.status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(a.body) });
  });
  return seen;
}
async function toBill(page: Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
}
const best = (body: any) => body.coupon_code === "WELCOME10"
  ? { status: 200, body: bill({ code: "WELCOME10", title: WELCOME10.title }, 3000, [FLAT50, WELCOME10]) }
  : body.coupon_code === "SAVE99" ? { status: 422, body: { ok: false, error: "coupon_invalid", message: "SAVE99 is not a valid code." } }
  : { status: 200, body: bill({ code: "FLAT50", title: FLAT50.title }, 5000, [FLAT50, WELCOME10]) };

test("S1 the best offer is applied, the slip shows the discount and To pay, the other offer has Apply (C1)", async ({ page, context }) => {
  const seen = await withQuote(context, page, best);
  await toBill(page);
  const offers = page.getByRole("region", { name: "Offers" });
  await expect(offers.getByText("FLAT50")).toBeVisible();
  await expect(offers.getByText("Save ₹50")).toBeVisible();
  await expect(offers.getByRole("button", { name: "Apply WELCOME10" })).toBeVisible();
  const slip = page.getByRole("region", { name: "Items" });
  await expect(slip.getByText("Discount · FLAT50")).toBeVisible();
  await expect(slip.getByText("−50")).toBeVisible();
  await expect(slip.getByText("To pay")).toBeVisible();
  await expect(page.getByTestId("bill-total")).toHaveText("₹310");
  await expect(page.getByRole("button", { name: /Place order/ })).toContainText("₹310");
  expect(seen.bodies[0]).toMatchObject({ kitchen_id: "k-1", address: { pin_code: "110016" }, lines: [{ menu_item_id: "d1", qty: 1 }] });
  expect(seen.bodies[0].coupon_code ?? null).toBeNull();
  expect(seen.auth[0]).toMatch(/^Bearer .+/);
});

test("S2 Apply on another offer asks the quote with that code and moves the mark", async ({ page, context }) => {
  const seen = await withQuote(context, page, best);
  await toBill(page);
  await page.getByRole("button", { name: "Apply WELCOME10" }).click();
  await expect(page.getByRole("region", { name: "Items" }).getByText("Discount · WELCOME10")).toBeVisible();
  await expect(page.getByTestId("bill-total")).toHaveText("₹330");
  await expect(page.getByRole("button", { name: "Apply FLAT50" })).toBeVisible();
  expect(seen.bodies.at(-1).coupon_code).toBe("WELCOME10");
});

test("S3 a typed code that is not valid shows the server's line, keeps the text and keeps the bill (C2)", async ({ page, context }) => {
  await withQuote(context, page, best);
  await toBill(page);
  const field = page.getByLabel("Have a code?");
  await field.fill("save99");
  await page.getByRole("button", { name: "Apply code" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "SAVE99 is not a valid code." })).toBeVisible();
  await expect(field).toHaveValue("SAVE99");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("bill-total")).toHaveText("₹310");
});

test("S4 the quote is down: the bill is the one of today, no Offers block", async ({ page, context }) => {
  await withQuote(context, page, () => ({ status: 502, body: { ok: false, error: "quote_unavailable" } }));
  await toBill(page);
  await expect(page.getByText("Cash at door")).toBeVisible();
  await expect(page.getByRole("region", { name: "Offers" })).toHaveCount(0);
  await expect(page.getByTestId("bill-total")).toHaveText("₹320");
});

test("S5 no offers and no coupon: no Offers block, the quote's total still shows", async ({ page, context }) => {
  await withQuote(context, page, () => ({ status: 200, body: bill(null, 0, []) }));
  await toBill(page);
  await expect(page.getByRole("region", { name: "Offers" })).toHaveCount(0);
  await expect(page.getByTestId("bill-total")).toHaveText("₹360");
});
