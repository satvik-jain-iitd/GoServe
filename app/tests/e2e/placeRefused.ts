// Story 1580: the server refuses the order (not_served). The Bill shows a true line with the way out above the bar, and the bar keeps its box (owner's rule 23, by measure).
// Run by Chromium (place-refused.spec.ts) and by WebKit (place-refused.webkit.spec.ts).
import { test, expect } from "@playwright/test";
import { setup, phoneAt } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString() };

export function placeRefused() {
  test("The server says the kitchen does not reach the address: the Bill says so in our words with the way out, and the bar does not move", async ({ page, context }) => {
    const net = await setup(context, page, [], { pin: null });
    net.state.addresses = [HOME];
    net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
    await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") }));
    await phoneAt(context, HOME);
    net.state.reply = { status: 422, body: { ok: false, error: "not_served", message: "This kitchen does not reach that address." } };
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Add Butter Chicken" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await page.getByLabel("Phone").fill("9876543210");
    const barBox = () => page.locator(".ui-sticky .ui-btn").evaluate((el) => { const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 10) / 10); });
    await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
    const before = await barBox();
    await page.getByRole("button", { name: /Place order/ }).click();
    const line = page.getByRole("alert");
    await expect(line).toHaveText("We do not deliver to this place yet. Choose another address.");
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    expect(await barBox()).toEqual(before);   // no layout shift: the line sits above the bar, the bar keeps its box
    const lineBottom = await line.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(lineBottom).toBeLessThanOrEqual(before[1] + 0.5);
  });
}
