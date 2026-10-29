// Fit-check screenshots for the PR (stories H10b to H10d): SHOTS=docs/mvp25/h10b-shots npx playwright test shots. Skipped in normal runs.
import { test } from "@playwright/test";
import { order, SESSION, setup, typePlace } from "./helpers";

const OUT = process.env.SHOTS;
const MENU = [
  { id: "t1", name: "Veg Thali", price_paise: 18000, image_url: null, image_credit: null, veg: true, category: "Thali" },
  { id: "t2", name: "Non-veg Thali", price_paise: 24000, image_url: null, image_credit: null, veg: false, category: "Thali" },
  { id: "d1", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, category: "Mains" },
  { id: "d2", name: "Paneer Butter Masala", price_paise: 26000, image_url: null, image_credit: null, veg: true, category: "Mains" },
  { id: "d3", name: "Chicken Curry", price_paise: 28000, image_url: null, image_credit: null, veg: false, category: "Mains" },
  { id: "d4", name: "Tandoori Roti", price_paise: 2000, image_url: null, image_credit: null, veg: true, category: "Breads" },
];
test.use({ viewport: { width: 390, height: 844 } });
test.skip(!OUT, "set SHOTS to a folder to take the screenshots");

for (const theme of ["day", "night"] as const) {
  test(`shots ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const net = await setup(context, page, [], { pin: null });
    net.state.menu = MENU;
    await page.goto("/customer/");
    await page.getByRole("heading", { name: "Where does the food go?" }).waitFor();
    await page.waitForTimeout(600);
    await shot("Main");
    await typePlace(page, "110099");
    await page.getByRole("button", { name: "See the menu" }).click();
    await page.getByText("We are not in 110099").waitFor();
    await shot("S-NoKitchen");
    await typePlace(page, "110016");
    await page.getByRole("button", { name: "See the menu" }).click();
    await page.getByRole("button", { name: "Add Dal Makhani" }).waitFor();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Add Dal Makhani" }).click();
    await page.getByRole("button", { name: "More Dal Makhani" }).click();
    await shot("Menu");
    await page.getByRole("button", { name: "Filter" }).click();
    await shot("Categories");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Chicken Curry details" }).click();
    await shot("Dish");
    await page.getByRole("button", { name: "Close", exact: true }).click();
  });
}

for (const theme of ["day", "night"] as const) {
  test(`shots states ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page, [], { pin: null });
    net.state.menu = MENU;
    net.state.kitchens = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: false, active: true, lat: null, lng: null, opens_at: "11:00:00" }];
    await page.goto("/customer/");
    await typePlace(page, "110016");
    await page.getByRole("button", { name: "See the menu" }).click();
    await page.getByRole("button", { name: "Add Dal Makhani" }).waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${theme}/S-Closed-${theme}.png` });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/rest/v1/menu_items*", async (route) => { await gate; await route.fallback(); });
    await page.evaluate(() => localStorage.removeItem("gs.menu.v1.k-1"));
    await page.reload();
    await page.getByLabel("Loading the menu").waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${theme}/S-Loading-${theme}.png` });
    release();
  });
}

const KITCHEN = { id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: "9876543210", pin_codes: ["110016"], open: true, active: true, lat: null, lng: null, opens_at: "00:00:00", closes_at: "23:59:00" };
for (const theme of ["day", "night"] as const) {
  test(`shots bill and tracker ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const net = await setup(context, page);
    net.state.menu = MENU;
    net.state.kitchens = [KITCHEN];
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Add Dal Makhani" }).click();
    await page.getByRole("button", { name: "Add Tandoori Roti" }).click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "More Tandoori Roti" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await page.getByLabel("Your name").fill("Rahul Verma");
    await page.getByLabel("Phone").fill("9876543210");
    await page.getByLabel("Address").fill("B-12, Lajpat Nagar II, near the park gate");
    await shot("Bill");
    await page.getByRole("button", { name: /Place order/ }).click();
    await page.getByRole("heading", { name: "Order placed" }).waitFor();
    await shot("Placed");
    net.push("UPDATE", order("preparing", new Date().toISOString()));
    await page.getByText("Live", { exact: true }).waitFor();
    await shot("Tracker");
    net.push("UPDATE", { ...order("delivered", new Date().toISOString()), paid_by: "cash" });
    await page.getByRole("heading", { name: "Delivered", exact: true }).waitFor();
    await shot("Delivered");
  });
  test(`shots empty bill ${theme}`, async ({ page, context }) => {
    await context.addInitScript(([v]) => { localStorage.setItem("gs-theme", v); localStorage.setItem("gs-draft", JSON.stringify({ step: "bill", cart: {}, address: "", name: "", phone: "" })); }, [theme]);
    const net = await setup(context, page);
    net.state.menu = MENU;
    await page.goto("/customer/");
    await page.getByRole("heading", { name: "Nothing on it yet" }).waitFor();
    await page.screenshot({ path: `${OUT}/${theme}/S-EmptyBill-${theme}.png` });
  });
}

for (const theme of ["day", "night"] as const) {
  test(`shots orders and you ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const mk = (id: string, status: string, at: string, qty: number) => ({ ...order(status, at), id, created_at: at, items: [{ menu_item_id: "d1", name: "Dal Makhani", qty, price_paise: 22000 }], total_paise: 22000 * qty });
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    const net = await setup(context, page, [mk("1042aaaa-1111-4222-8333-444444444444", "preparing", new Date().toISOString(), 1), mk("1031aaaa-1111-4222-8333-444444444444", "delivered", day(3), 3), mk("1018aaaa-1111-4222-8333-444444444444", "delivered", day(6), 2), mk("1004aaaa-1111-4222-8333-444444444444", "cancelled", day(10), 2)]);
    net.state.menu = MENU;
    net.state.kitchens = [KITCHEN];
    net.state.customer = { user_id: "u", name: "Rahul Verma", phone: "9876543210", address: "B-12, Lajpat Nagar II, near the park gate", pin_code: "110016" };
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Back to menu" }).click();
    await page.getByRole("button", { name: "My orders" }).click();
    await page.getByRole("heading", { name: "Your orders" }).waitFor();
    await shot("Orders");
    await page.getByRole("button", { name: "You (Account)" }).click();
    await page.getByRole("heading", { name: "You", exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot("Account");
  });
  test(`shots empty orders ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    await setup(context, page);
    await page.goto("/customer/");
    await page.getByRole("button", { name: "My orders" }).click();
    await page.getByText("No orders yet").waitFor();
    await page.screenshot({ path: `${OUT}/${theme}/S-EmptyOrders-${theme}.png` });
  });
  test(`shots rider ${theme}`, async ({ page, context }) => {   // story H11 (#194): boards R1 to R9
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const now = new Date().toISOString();
    const net = await setup(context, page, [{ ...order("ready"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", address: "B-12, Lajpat Nagar II, near the park gate" },
      { ...order("delivered", now, now), id: "1038aaaa-0000-0000-0000-000000000000", rider_id: SESSION, customer_name: "Meera Kapoor", address: "Lajpat Nagar II", total_paise: 26000 }]);
    net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
    net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II, back lane", phone: "9876500000", pin_codes: ["110024"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
    await page.goto("/rider/");
    await page.getByText("Collect cash").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot("R-PickUp");
    await page.getByRole("button", { name: "Pick up 0f0f0f0f" }).click();
    await page.getByText("On the way", { exact: true }).waitFor();
    await shot("R-OnTheWay");
    await page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true }).click();
    await page.getByText("Cash collected").waitFor();
    await shot("R-Delivered");
    await page.getByRole("button", { name: "Next delivery" }).click();
    await page.getByRole("heading", { name: "Waiting for a delivery" }).waitFor();
    await shot("R-Online");
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.getByText("Cash in hand").waitFor();
    await shot("R-Today");
    await page.getByRole("button", { name: "Me", exact: true }).click();
    await page.getByRole("switch", { name: "Online" }).waitFor();
    await shot("R-Me");
    await page.getByRole("switch", { name: "Online" }).click();
    await page.getByRole("button", { name: "Job", exact: true }).click();
    await page.getByRole("heading", { name: "You are offline" }).waitFor();
    await shot("R-Offline");
  });
  test(`shots rider gates ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const net = await setup(context, page);
    net.state.rider = null;
    await page.goto("/rider/");
    await page.getByRole("heading", { name: "Sign in to ride" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot("R-SignIn");
    net.state.anonymous = false;
    await page.reload();
    await page.getByRole("heading", { name: "Not a rider yet" }).waitFor();
    await shot("R-NotRider");
  });
  test(`shots kitchen ${theme}`, async ({ page, context }) => {   // story H11 (#194): boards K1 to K6
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const now = new Date().toISOString();
    const net = await setup(context, page, [
      { ...order("placed"), id: "1043aaaa-0000-0000-0000-000000000000", items: [{ menu_item_id: "t1", name: "Veg thali", qty: 1, price_paise: 18000 }, { menu_item_id: "d4", name: "Tandoori Roti", qty: 2, price_paise: 2000 }], total_paise: 22000, customer_name: "Rahul Verma", address: "B-12, Lajpat Nagar II, near the park gate" },
      { ...order("placed", "2020-01-01T10:03:00Z", "2020-01-01T10:03:00Z"), id: "1044aaaa-0000-0000-0000-000000000000", items: [{ menu_item_id: "t2", name: "Non-veg thali", qty: 2, price_paise: 24000 }], total_paise: 48000 },
      { ...order("preparing"), id: "1042aaaa-0000-0000-0000-000000000000", items: [{ menu_item_id: "d1", name: "Dal Makhani", qty: 1, price_paise: 22000 }, { menu_item_id: "d4", name: "Tandoori Roti", qty: 4, price_paise: 2000 }], total_paise: 30000 },
      { ...order("accepted"), id: "1040aaaa-0000-0000-0000-000000000000", items: [{ menu_item_id: "t1", name: "Veg thali", qty: 1, price_paise: 18000 }], total_paise: 18000 },
      { ...order("ready"), id: "1041aaaa-0000-0000-0000-000000000000", items: [{ menu_item_id: "t2", name: "Non-veg thali", qty: 1, price_paise: 24000 }], total_paise: 24000 },
      { ...order("delivered", now, now), id: "1030aaaa-0000-0000-0000-000000000000", total_paise: 374000 }]);
    net.state.kitchen = "k-1";
    net.state.kitchens = [{ id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110024"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
    net.state.menu = MENU.map((d, i) => ({ ...d, available: i !== 3 }));
    await page.goto("/kitchen/");
    await page.getByText("No. 1043aaaa").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot("K-Tickets");
    await page.getByRole("button", { name: "Open ticket 1043aaaa" }).click();
    await page.getByRole("heading", { name: "Ticket" }).waitFor();
    await shot("K-Ticket");
    await page.getByRole("button", { name: "Back to new tickets" }).click();
    await page.getByRole("button", { name: "Cooking", exact: true }).click();
    await page.getByRole("heading", { name: "Ready · rider on the way" }).waitFor();
    await shot("K-Cooking");
    await page.getByRole("button", { name: "Kitchen", exact: true }).click();
    await page.getByRole("switch", { name: "Open for orders" }).waitFor();
    await page.getByText("Paneer Butter Masala").waitFor();
    await shot("K-YourKitchen");
  });
  test(`shots kitchen states ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const now = new Date().toISOString();
    const net = await setup(context, page, Array.from({ length: 11 }, (_, i) => ({ ...order("delivered", now, now), id: `10${String(i).padStart(2, "0")}aaaa-0000-0000-0000-000000000000` })));
    net.state.kitchen = "k-1";
    await page.goto("/kitchen/");
    await page.getByRole("heading", { name: "No new tickets" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot("K-NoTickets");
    net.state.kitchen = null;
    await page.reload();
    await page.getByRole("heading", { name: "Sign in to cook" }).waitFor();
    await shot("K-SignIn");
    net.state.anonymous = false;
    await page.reload();
    await page.getByRole("heading", { name: "Not kitchen staff yet" }).waitFor();
    await shot("K-NotStaff");
  });
  test(`shots admin ${theme}`, async ({ page, context }) => {   // story H12 (#195): boards A1 to A4 and A8
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const K = (over: object) => ({ ...order("placed"), kitchen_id: "k", cancel_reason: null, ...over });
    const net = await setup(context, page, [
      K({ id: "1044aaaa-0000-0000-0000-000000000000", created_at: "2026-10-24T14:25:00Z", customer_name: "Meera Kapoor", customer_phone: "9876543210", total_paise: 48000, items: [{ menu_item_id: "t2", name: "Non-veg thali", qty: 2, price_paise: 24000 }] }),
      K({ id: "1043aaaa-0000-0000-0000-000000000000", created_at: "2026-10-24T14:22:00Z", status: "preparing", customer_name: "Rahul Verma", customer_phone: "9876543210", total_paise: 26000, items: [{ menu_item_id: "t1", name: "Veg thali", qty: 1, price_paise: 18000 }, { menu_item_id: "d4", name: "Tandoori Roti", qty: 2, price_paise: 2000 }], address: "B-12, Lajpat Nagar II, near the park gate" }),
      K({ id: "1042aaaa-0000-0000-0000-000000000000", created_at: "2026-10-24T14:10:00Z", status: "out_for_delivery", customer_name: "Rahul Verma", total_paise: 34000, rider_id: "r1" }),
      K({ id: "1040aaaa-0000-0000-0000-000000000000", created_at: "2026-10-24T14:06:00Z", status: "delivered", customer_name: "Priya Nair", total_paise: 18000 }),
      K({ id: "1039aaaa-0000-0000-0000-000000000000", created_at: "2026-10-24T14:00:00Z", status: "cancelled", customer_name: "Karan Mehta", total_paise: 36000, cancel_reason: "customer asked" })]);
    net.state.admin = true;
    net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500011", pin_codes: ["110024"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" }, { id: "k2", name: "Amma's Kitchen", address: null, phone: null, pin_codes: ["110016"], open: false, active: true, opens_at: null, closes_at: null }];
    net.state.numbers = [{ day: "2026-10-24", kitchen_id: "k", kitchen_name: "Tau Ka Dhaba", orders: 23, delivered: 18, cancelled: 1, cash_paise: 614000 }];
    await page.goto("/admin/");
    await page.getByRole("heading", { name: "Live" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot("A-Orders");
    await page.getByRole("button", { name: /^Open order 1043aaaa/ }).click();
    await page.getByRole("heading", { name: "Order", exact: true }).waitFor();
    await shot("A-Order");
    await page.getByRole("button", { name: "Back to orders" }).click();
    await page.getByRole("button", { name: "Numbers", exact: true }).click();
    await page.getByTestId("day-total").waitFor();
    await shot("A-Numbers");
    net.state.admin = false;
    await page.reload();
    await page.getByRole("heading", { name: "Sign in to run the city" }).waitFor();
    await shot("A-SignIn");
    net.state.anonymous = false;
    await page.reload();
    await page.getByRole("heading", { name: "Not an admin account" }).waitFor();
    await shot("A-NotAdmin");
  });
  test(`shots admin city ${theme}`, async ({ page, context }) => {   // story H12b (#195): boards A5 to A7
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${theme}/${name}-${theme}.png` });
    const net = await setup(context, page);
    net.state.admin = true;
    net.state.kitchens = [
      { id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II, back lane", phone: "9876500011", pin_codes: ["110024", "110025"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" },
      { id: "k2", name: "Amma's Kitchen", address: null, phone: null, pin_codes: ["110016", "110017"], open: true, active: true, opens_at: null, closes_at: null },
      { id: "k3", name: "Punjab Rasoi", address: null, phone: null, pin_codes: ["110048"], open: false, active: true, opens_at: null, closes_at: null }];
    net.state.people = [{ kind: "kitchen", user_id: "u-1", email: "sunita@example.com", kitchen_id: "k", kitchen_name: "Tau Ka Dhaba" }, { kind: "kitchen", user_id: "u-2", email: "raju@example.com", kitchen_id: "k", kitchen_name: "Tau Ka Dhaba" }, { kind: "kitchen", user_id: "u-3", email: "lakshmi@example.com", kitchen_id: "k2", kitchen_name: "Amma's Kitchen" }];
    net.state.riders = [{ user_id: "r1", name: "Amit Kumar", phone: "9810011223", online: true }, { user_id: "r2", name: "Ravi Yadav", phone: "9810011224", online: true }, { user_id: "r3", name: "Deepak Singh", phone: null, online: false }];
    net.state.menu = MENU.map((d, i) => ({ ...d, kitchen_id: "k", available: i !== 3 }));
    await page.goto("/admin/");
    await page.getByRole("button", { name: "City", exact: true }).click();
    await page.getByText("Amit Kumar").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot("A-City");
    await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
    await page.getByText("Paneer Butter Masala").waitFor();
    await shot("A-Kitchen");
    await page.getByRole("button", { name: "Back to city" }).click();
    await page.getByRole("button", { name: "Add a kitchen" }).click();
    await page.getByRole("heading", { name: "Add a kitchen" }).waitFor();
    await page.getByLabel("Kitchen name").fill("Punjab Rasoi");
    await page.getByLabel("Address").fill("A-12, Greater Kailash I");
    await page.getByLabel("Phone").fill("9810022334");
    await page.getByLabel("Pin codes").fill("11004");
    await shot("A-AddKitchen");
  });
}
