// The screens of docs/screens.txt and the steps that reach them. Shared by screens.spec.ts (pictures) and overflow.webkit.spec.ts (iPhone width gate, story #999).
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { order, setup } from "./helpers";

export type Screen = { name: string; path: string; width: number; height: number; step: string };
export const screens: Screen[] = readFileSync(resolve(import.meta.dirname, "../../../docs/screens.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [name, path, vp, step] = l.split("|").map((x) => x.trim());
    const [width, height] = vp.split("x").map(Number);
    return { name, path, width, height, step };
  });

export const NINE = new Date(2026, 9, 27, 9, 0, 0);   // the greeting depends on the clock

// The steps below are the ones the other specs already use to reach these screens.
// Story 829: `welcome` is the front door as production shows it (phone code switch off: Google only); `welcome-phone` is the same door with the switch on.
// The rows of the boards C9 to C13, the phone in Chhatarpur, and Deliver to opened. serve: false answers "no kitchen reaches this".
// pin_code is the test kitchen's so the menu opens; the boards show the pin inside the words, which are untouched.
const BOARD_ROWS = [
  { id: "h1", label: "Home", address: "C-128, In front of Shiv Mandir Ground, Green Avenue Colony, Chhatarpur, Madhya Pradesh 471001", pin_code: "110016", lat: 24.9167, lng: 79.5833, last_used_at: "2026-11-08T10:00:00Z" },
  { id: "o1", label: "Office", address: "2nd floor, Mahoba Road, near the bus stand, Chhatarpur 471001", pin_code: "110016", lat: 24.9437, lng: 79.5833, last_used_at: "2026-11-07T10:00:00Z" },
  { id: "b1", label: "Bhopal home", address: "Flat 41, Chitragupt Nagar, Kotra, Aradhana Nagar, Bhopal 462003", pin_code: "110016", lat: 23.2599, lng: 77.4126, last_used_at: "2026-11-06T10:00:00Z" },
  { id: "w1", label: "Work", address: "171/7, Hari Singh Yadav House, Gali Number 7, Hans Enclave, Gurugram 122004", pin_code: "110016", lat: 28.4595, lng: 77.0266, last_used_at: "2026-11-05T10:00:00Z" },
  { id: "s1", label: "Shubhi", address: "Room no. 407, beside Melange Tower, Patrika Nagar, Madhapur, Hyderabad 500081", pin_code: "110016", lat: 17.4486, lng: 78.3908, last_used_at: "2026-11-04T10:00:00Z" },
];
async function deliverFrom(context: BrowserContext, page: Page, path: string, rows: number, o: { serve?: boolean } = {}) {
  const net = await setup(context, page, [], { pin: "110016" });   // the test kitchen serves 110016; the rows keep the boards words
  net.state.addresses = BOARD_ROWS.slice(0, rows);
  net.state.geocode = { status: 200, body: { ok: true, address: "Green Avenue Colony, Chhatarpur, Madhya Pradesh", pin: "471001", locality: "Chhatarpur", town: "Chhatarpur" } };
  if (o.serve === false) net.state.serve = { status: 200, body: { ok: true, serviceable: false, kitchens: [] } };
  await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4+vg+AAVYAqhyXHCrAAAAAElFTkSuQmCC", "base64") }));
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 24.9167, longitude: 79.5833 });
  await page.goto(path);
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).first().click(); await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible();
}

export const STEPS: Record<string, (context: BrowserContext, page: Page, path: string) => Promise<void>> = {
  welcome: async (context, page, path) => { await setup(context, page, [], { guest: true }); await page.goto(path); await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible(); },
  "welcome-phone": async (context, page, path) => { const net = await setup(context, page, [], { guest: true }); net.state.otpLogin = true; await page.goto(path); await expect(page.getByLabel("Mobile", { exact: true })).toBeVisible(); },
  menu: async (context, page, path) => { await setup(context, page); await page.goto(path); await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible(); },
  bill: async (context, page, path) => {
    await setup(context, page); await page.goto(path);
    await page.getByRole("button", { name: "Add Butter Chicken" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  },
  account: async (context, page, path) => { const net = await setup(context, page); net.state.phoneUser = true; await page.goto(path);   // story 829: signed in by phone code (no Google name), so You shows the Google row as in the accepted picture
    await page.getByRole("button", { name: "Account" }).click(); await expect(page.getByTestId("account")).toBeVisible(); },
  cancelled: async (context, page, path) => {   // story 916: the slip after a cancel
    const net = await setup(context, page, [order("placed")]); await page.goto(path);
    await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
    net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z")); await expect(page.getByText("Your order was cancelled")).toBeVisible({ timeout: 5000 }); },
  "add-kitchen": async (context, page, path) => {   // story 923: the admin's Add kitchen form
    const net = await setup(context, page); net.state.admin = true; await page.goto(path);
    await page.getByRole("button", { name: "City", exact: true }).click(); await page.getByRole("button", { name: "Add a kitchen" }).click();
    await expect(page.getByLabel("Kitchen name")).toBeVisible(); },
  "add-dish": async (context, page, path) => {   // story 923: the admin's Add dish form
    const net = await setup(context, page); net.state.admin = true; await page.goto(path);
    await page.getByRole("button", { name: "City", exact: true }).click(); await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
    await page.getByRole("button", { name: "Add a dish" }).click(); await expect(page.getByLabel("Dish name")).toBeVisible(); },
  "dish-edit": async (context, page, path) => {   // story 936: the Edit dish sheet, board M2-DishEdit
    const net = await setup(context, page); net.state.admin = true; await page.goto(path);
    await page.getByRole("button", { name: "City", exact: true }).click(); await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
    await page.getByRole("button", { name: "Edit Butter Chicken" }).click(); await expect(page.getByRole("dialog", { name: "Edit Butter Chicken" })).toBeVisible(); },
  "edit-kitchen": async (context, page, path) => {   // story #990: the Edit details sheet, board K-EditKitchen
    const net = await setup(context, page); net.state.admin = true; await page.goto(path);
    await page.getByRole("button", { name: "City", exact: true }).click(); await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
    await page.getByRole("button", { name: "Edit details" }).click(); await expect(page.getByRole("dialog", { name: "Edit Hauz Khas Kitchen" })).toBeVisible(); },
  "deliver-to": async (context, page, path) => {   // story #976: the Deliver to page, board C2-AddressSheet
    const net = await setup(context, page, [], { pin: "110016" }); net.state.addresses = [
      { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" },
      { id: "o1", label: "Office", address: "Tower B, Connaught Place, New Delhi", pin_code: "110016", lat: 28.6315, lng: 77.2167, last_used_at: "2026-11-01T10:00:00Z" }];
    await page.goto(path);
    await page.getByRole("button", { name: /^(Home|Office|Deliver to)\b/ }).click(); await expect(page.getByRole("heading", { name: "Deliver to", exact: true })).toBeVisible(); },
  "deliver-to-search": async (context, page, path) => {   // story #1036: Deliver to after a submitted search, board C8-SearchResults
    const net = await setup(context, page, [], { pin: "110016" }); net.state.addresses = [
      { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" },
      { id: "o1", label: "Office", address: "Tower B, Connaught Place, New Delhi", pin_code: "110016", lat: 28.6315, lng: 77.2167, last_used_at: "2026-11-01T10:00:00Z" }];
    net.state.places = { status: 200, body: { ok: true, results: [
      { name: "Green Park", address: "Green Park, Delhi, 110016", lat: 28.5599, lng: 77.2065, pin: "110016", served: true },
      { name: "Green Park Extension", address: "Green Park Extension, Delhi, 110049", lat: 28.5575, lng: 77.206, pin: "110049", served: false }] } };
    await page.goto(path);
    await page.getByRole("button", { name: /^(Home|Office|Deliver to)\b/ }).click();
    const box = page.getByRole("searchbox", { name: "Search an area or address" }); await box.fill("green park"); await box.press("Enter");
    await expect(page.getByText("Places · 2 found")).toBeVisible(); },
  "pin-map": async (context, page, path) => {   // story #1037: the one full-screen map, board C6-PinMap (tiles answered with one warm grey pixel, words and served answered by the mocks)
    const net = await setup(context, page, [], { pin: "110016" }); net.state.addresses = [{ id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" }];
    net.state.geocode = { status: 200, body: { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" } };
    await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4+vg+AAVYAqhyXHCrAAAAAElFTkSuQmCC", "base64") }));
    await page.goto(path); await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).click(); await page.getByRole("button", { name: "Add new address" }).click();
    await expect(page.getByText("We deliver here · the kitchen is 1.2 km from the pin")).toBeVisible(); },
  // Story #1051: the boards of batch B. The data is the boards' own (a phone in Chhatarpur, the rows of C12), so the picture and the board can be laid side by side.
  "deliver-five": async (context, page, path) => {   // boards C12 (this, three rows and View all)
    await deliverFrom(context, page, path, 5);
    await expect(page.getByRole("button", { name: "View all" })).toBeVisible(); },
  "deliver-all": async (context, page, path) => {   // board C13: View all opened
    await STEPS["deliver-five"](context, page, path);
    await page.getByRole("button", { name: "View all" }).click(); await expect(page.getByRole("listitem")).toHaveCount(5); },
  "deliver-removed": async (context, page, path) => {   // board C10: Home removed, the Undo bar
    await deliverFrom(context, page, path, 3);
    await page.getByRole("button", { name: "Edit or remove Home" }).click(); await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Home removed" })).toBeVisible(); },
  "deliver-empty": async (context, page, path) => {   // board C11: no saved address yet
    await deliverFrom(context, page, path, 0);
    await expect(page.getByText("No saved address yet")).toBeVisible(); },
  "edit-on-map": async (context, page, path) => {   // board C9: Edit opens the same map, pin on Home, Save changes
    await deliverFrom(context, page, path, 3);
    await page.getByRole("button", { name: "Edit or remove Home" }).click(); await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByText("We deliver here · the kitchen is 1.2 km from the pin")).toBeVisible(); },
  "pin-map-far": async (context, page, path) => {   // board C6b: the pin far from the phone and outside our area, both strips
    await deliverFrom(context, page, path, 3, { serve: false });
    await page.getByRole("button", { name: "Add new address" }).click();
    await context.setGeolocation({ latitude: 25.9, longitude: 79.5 });   // the phone moves away after the map opened: the pin is now far from it
    await expect(page.getByText("Not in our area yet")).toBeVisible(); await expect(page.getByText(/km from where you are now$/)).toBeVisible(); },
  "pin-details": async (context, page, path) => {   // story #1038: the details sheet over the map, board C7-PinDetails
    await STEPS["pin-map"](context, page, path);
    await page.getByRole("button", { name: "Confirm & proceed" }).click();
    await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible(); },
  "remove-kitchen": async (context, page, path) => {   // story 955: the danger sheet, board D1-RemoveKitchen
    const net = await setup(context, page); net.state.admin = true; await page.goto(path);
    await page.getByRole("button", { name: "City", exact: true }).click(); await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
    await page.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click();
    await expect(page.getByRole("dialog", { name: /^Remove / })).toBeVisible(); },
  "clear-everything": async (context, page, path) => {   // story 955: the danger sheet, board D2-ClearEverything
    const net = await setup(context, page); net.state.admin = true; await page.goto(path);
    await page.getByRole("button", { name: "Simulator", exact: true }).click(); await page.getByRole("button", { name: "Clear everything" }).click();
    await expect(page.getByRole("dialog", { name: "Clear everything?" })).toBeVisible(); },
  "order-sheet": async (context, page, path) => {   // story 934: board K3-OrderSheet
    const net = await setup(context, page, [order("placed")]); net.state.kitchen = "k-1"; await page.goto(path);
    await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click(); await expect(page.getByRole("dialog", { name: "Order 0f0f0f0f" })).toBeVisible(); },
  "order-decline": async (context, page, path) => {   // story 934: board K3-OrderDecline
    const net = await setup(context, page, [order("placed")]); net.state.kitchen = "k-1"; await page.goto(path);
    await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click(); await page.getByRole("button", { name: "Decline, with a reason" }).click();
    await page.getByLabel("Reason").fill("We are out of paneer tonight, so the veg thali cannot be made."); },
  declined: async (context, page, path) => {   // story 934: board T2-Declined
    await setup(context, page, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancel_reason: "We are out of paneer tonight, so the veg thali cannot be made." }]);
    await page.goto(path); await page.getByRole("button", { name: "History" }).click(); await page.getByRole("button", { name: /Butter Chicken/ }).click();
    await expect(page.getByRole("heading", { name: "Declined" })).toBeVisible(); },
  orders: async (context, page, path) => { await setup(context, page); await page.goto(path); await page.getByRole("button", { name: "History" }).click(); await page.waitForLoadState("networkidle"); },
};
