// Story 1421 (owner 13 Nov 2026, boards AD3, ED1, ED2): one box "House, street, colony, ward", saved whole and shown whole on Edit (no cutting at commas).
// Edit opens the filled sheet; the map opens only on Change; the typed box and landmark are kept across Change and back.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";
import { STEPS } from "./screensSteps";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const BOX = "House, street, colony, ward";
const row = (extra: Record<string, unknown>) => ({ id: "h1", label: "Home", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date().toISOString(), ...extra });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Address details" });

async function toEdit(page: Page, context: Parameters<typeof setup>[0], saved: object) {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [saved];
  net.state.geocode = { status: 200, body: GREEN_PARK };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).first().click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  return net;
}

test("O1 the first box is House, street, colony, ward with the board's example, and there is no second box", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(sheet(page).getByLabel(BOX)).toHaveAttribute("placeholder", "e.g. C-128, Gali 3, Radio Colony");
  await expect(sheet(page).getByLabel("House, flat, floor")).toHaveCount(0);
  await expect(sheet(page).getByLabel(/^Street, colony/)).toHaveCount(0);
  await expect(sheet(page).getByLabel("Landmark (optional)")).toBeVisible();
});

test("O2 the box is saved whole: C-128, second floor keeps its floor, and the landmark keeps its words", async ({ page, context }) => {
  const net = await toEdit(page, context, row({ address: "C-128, near the park gate, Green Park, New Delhi, Delhi", house: "C-128", landmark: "the park gate" }));
  await sheet(page).getByLabel(BOX).fill("C-128, second floor, Gali 3");
  await sheet(page).getByLabel("Landmark (optional)").fill("blue gate, by the temple");
  await sheet(page).getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => net.state.addresses[0].house).toBe("C-128, second floor, Gali 3");
  expect(net.state.addresses[0].landmark).toBe("blue gate, by the temple");
  expect(net.state.addresses[0].address).toBe("C-128, second floor, Gali 3, near blue gate, by the temple, Green Park, New Delhi, Delhi");   // the rider reads the box, the landmark, then the pin words
});

test("O3 Edit opens the filled sheet, not the map, and shows the box and landmark whole", async ({ page, context }) => {
  await toEdit(page, context, row({ address: "C-128, second floor, near the park gate, Green Park, New Delhi, Delhi", house: "C-128, second floor", landmark: "the park gate" }));
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByLabel(BOX)).toHaveValue("C-128, second floor");
  await expect(sheet(page).getByLabel("Landmark (optional)")).toHaveValue("the park gate");
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(1);   // only the sheet's button: the map's own step is not shown
});

test("O4 an old saved address opens with its whole text before the pin words in the box; nothing is lost", async ({ page, context }) => {
  await toEdit(page, context, row({ address: "C-128, second floor, near the park gate, Green Park, New Delhi, Delhi", house: null, landmark: null }));
  await expect(sheet(page).getByLabel(BOX)).toHaveValue("C-128, second floor, near the park gate");
  await expect(sheet(page).getByLabel("Landmark (optional)")).toHaveValue("");
});

test("O5 the typed box and landmark are kept across Change and back, in first set-up", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await sheet(page).getByLabel(BOX).fill("C-128, Gali 3, Radio Colony");
  await sheet(page).getByLabel("Landmark (optional)").fill("near the water tank");
  await sheet(page).getByRole("button", { name: "Change", exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(sheet(page).getByLabel(BOX)).toHaveValue("C-128, Gali 3, Radio Colony");
  await expect(sheet(page).getByLabel("Landmark (optional)")).toHaveValue("near the water tank");
});

test("O6 Edit: Change opens the map, and back keeps what was typed", async ({ page, context }) => {
  await toEdit(page, context, row({ address: "C-128, near the park gate, Green Park, New Delhi, Delhi", house: "C-128", landmark: "the park gate" }));
  await sheet(page).getByLabel(BOX).fill("C-130");
  await sheet(page).getByRole("button", { name: "Change", exact: true }).click();
  await expect(page.getByText("Editing Home")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet(page).getByLabel(BOX)).toHaveValue("C-130");
});

test("O7 (board AD3L1) a long address: the box stays one line of the same height, the end stays in view, the sheet keeps its height, the limit is 120", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  const box = sheet(page).getByLabel(BOX);
  await box.pressSequentially("C-1");
  const h0 = (await sheet(page).boundingBox())!.height;
  const b0 = (await box.boundingBox())!.height;   // 45 px today, like every field on this sheet
  await box.fill("");
  await box.pressSequentially("C-128, Gali 3, Radio Colony, behind the old water tank, near Sharma General Store, ward 14, Satai Road extension ok");
  await box.pressSequentially("x".repeat(20));
  const v = await box.inputValue();
  expect(v.length).toBe(120);
  expect(await box.evaluate((el) => el.tagName)).toBe("INPUT");
  expect((await box.boundingBox())!.height).toBe(b0);
  expect(await box.evaluate((el: HTMLInputElement) => el.scrollLeft)).toBeGreaterThan(0);   // the start slid left: the end and the caret are in view
  expect((await sheet(page).boundingBox())!.height).toBe(h0);
});

test("O8 (board ED1) the sheet title is Edit address on Edit, and Address details in first set-up", async ({ page, context }) => {
  await toEdit(page, context, row({ address: "C-128, Green Park, New Delhi, Delhi", house: "C-128", landmark: "" }));
  await expect(page.getByRole("heading", { name: "Edit address" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Address details" })).toHaveCount(0);
});

test("O9 first set-up keeps the title Address details", async ({ page, context }) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(page.getByRole("heading", { name: "Address details" })).toBeVisible();
});
