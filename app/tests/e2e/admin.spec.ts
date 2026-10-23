// Story A2 (#149): the admin app at /admin/. Supabase is answered by the test (see helpers.ts).
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

test("S1 an admin sees the Kitchens and Staff tabs and the kitchens", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await expect(page.getByRole("tab", { name: "Kitchens" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Staff" })).toBeVisible();
  await expect(page.getByText("Hauz Khas Kitchen")).toBeVisible();
  await expect(page).toHaveTitle("GoServe Admin");
});

test("S2 someone who is not an admin sees 'Not allowed' and no tabs", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/admin/");
  await expect(page.getByText("Not allowed")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Kitchens" })).toHaveCount(0);
});

test("S3 adding a kitchen sends its name and pin codes; a bad pin code is refused before sending", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByLabel("Kitchen name").fill("Lajpat Nagar Kitchen");
  await page.getByLabel("Address").fill("12 Lajpat Nagar, Delhi");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Pin codes").fill("1100");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect(page.getByRole("alert")).toContainText("1100");
  expect(net.calls.kitchenWrites).toHaveLength(0);
  await page.getByLabel("Pin codes").fill("110024, 110049");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBe(1);
  expect(net.calls.kitchenWrites[0].method).toBe("POST");
  expect(net.calls.kitchenWrites[0].body).toMatchObject({ name: "Lajpat Nagar Kitchen", pin_codes: ["110024", "110049"] });
});

test("S4 adding staff by email with a role, and removing one", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [{ kind: "rider", user_id: "u-9", email: "rider@example.com", kitchen_id: null, kitchen_name: null }];
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Staff" }).click();
  await expect(page.getByText("rider@example.com")).toBeVisible();
  await page.getByLabel("Email").fill("cook@example.com");
  await page.getByLabel("Role").selectOption("kitchen");
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "admin_add_person").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "admin_add_person")!.body).toEqual({ p_email: "cook@example.com", p_kind: "kitchen", p_kitchen: "k-1" });
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "admin_remove_person").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "admin_remove_person")!.body).toEqual({ p_kind: "rider", p_user: "u-9", p_kitchen: null });
});

const PHOTO = { name: "dish.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") };

test("S5 the Menu tab adds a dish with a photo: the photo is uploaded, then the dish is saved with its price in paise", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Menu" }).click();
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByLabel("Dish name").fill("Dal Makhani");
  await page.getByLabel("Price (₹)").fill("220.50");
  await page.getByLabel("Category").fill("main");
  await page.getByLabel("Photo").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.uploads).toHaveLength(1);
  expect(net.calls.uploads[0]).toMatch(/\/storage\/v1\/object\/menu\/k-1\/.+\.png$/);
  expect(net.calls.menuWrites[0]).toMatchObject({ method: "POST", body: { kitchen_id: "k-1", name: "Dal Makhani", price_paise: 22050, category: "main", veg: true } });
  expect(net.calls.menuWrites[0].body.image_url).toMatch(/\/storage\/v1\/object\/public\/menu\/k-1\/.+\.png$/);
});

test("S6 a wrong price or a file that is not a picture is refused before anything is sent", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Menu" }).click();
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByLabel("Dish name").fill("Dal");
  await page.getByLabel("Price (₹)").fill("abc");
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect(page.getByRole("alert")).toContainText("price");
  await page.getByLabel("Price (₹)").fill("100");
  await page.getByLabel("Photo").setInputFiles({ name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") });
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect(page.getByRole("alert")).toContainText("picture");
  expect(net.calls.menuWrites).toHaveLength(0);
  expect(net.calls.uploads).toHaveLength(0);
});

test("S7 a dish can be marked sold out, get a new price, and be deleted", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Menu" }).click();
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await expect(page.getByText("Butter Chicken", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0]).toMatchObject({ method: "PATCH", body: { available: false } });
  await page.getByLabel("New price for Butter Chicken").fill("350");
  await page.getByRole("button", { name: "Save price of Butter Chicken" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(2);
  expect(net.calls.menuWrites[1]).toMatchObject({ method: "PATCH", body: { price_paise: 35000 } });
  await page.getByRole("button", { name: "Delete Butter Chicken" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(3);
  expect(net.calls.menuWrites[2].method).toBe("DELETE");
});

const KITCHEN_ORDER = (over: object = {}) => ({ ...order("placed"), kitchen_id: "k-1", customer_name: "Asha", customer_phone: "9876543210", cancel_reason: null, ...over });

test("S8 the Orders tab lists today's orders of all kitchens with who ordered, and filters by status", async ({ page, context }) => {
  const net = await setup(context, page, [KITCHEN_ORDER(), KITCHEN_ORDER({ id: "11111111-1111-4111-8111-111111111111", status: "delivered", customer_name: "Ravi" })]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Orders" }).click();
  await expect(page.getByText("Asha")).toBeVisible();
  await expect(page.getByText("Ravi")).toBeVisible();
  await page.getByLabel("Status").selectOption("delivered");
  await expect(page.getByText("Ravi")).toBeVisible();
  await expect(page.getByText("Asha")).toHaveCount(0);
});

test("S9 an admin cancels a placed order with a reason; the reason is required", async ({ page, context }) => {
  const net = await setup(context, page, [KITCHEN_ORDER()]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Orders" }).click();
  await page.getByRole("button", { name: /^Cancel order/ }).click();
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await expect(page.getByRole("alert")).toContainText("reason");
  expect(net.calls.rpc.filter((c) => c.name === "cancel_order")).toHaveLength(0);
  await page.getByLabel("Reason").fill("kitchen out of stock");
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "cancel_order").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "cancel_order")!.body).toEqual({ p_order: "0f0f0f0f-1111-4222-8333-444444444444", p_reason: "kitchen out of stock" });
});

test("S10 the Numbers tab shows the day total and one line per kitchen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.numbers = [
    { day: "2026-10-23", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen", orders: 5, delivered: 3, cancelled: 1, cash_paise: 90000 },
    { day: "2026-10-23", kitchen_id: "k-2", kitchen_name: "Rohini Kitchen", orders: 2, delivered: 2, cancelled: 0, cash_paise: 40000 },
  ];
  await page.goto("/admin/");
  await page.getByRole("tab", { name: "Numbers" }).click();
  await expect(page.getByTestId("day-total")).toContainText("7 orders");
  await expect(page.getByTestId("day-total")).toContainText("₹1300");
  await expect(page.getByText("Hauz Khas Kitchen")).toBeVisible();
  await expect(page.getByText("Rohini Kitchen")).toBeVisible();
});

test("S11 the Ops app is for admins only and shows the same day numbers", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.numbers = [{ day: "2026-10-23", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen", orders: 5, delivered: 3, cancelled: 1, cash_paise: 90000 }];
  await page.goto("/ops/");
  await expect(page.getByText("Not allowed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ops", exact: true })).toHaveCount(0);
  net.state.admin = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ops", exact: true })).toBeVisible();
  await expect(page.getByTestId("day-total")).toContainText("5 orders");
});
