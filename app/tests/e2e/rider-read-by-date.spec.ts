// Story 1496: the rider's order read is by date, so a rider with more rows than the API cap (1,000) still sees every day of the admin's range,
// his old unhanded cash and his live jobs. The REST answer is mocked like PostgREST: filters, order, offset/limit, and a hard cap of 1,000 rows.
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const at = (d: number, h: number, m = 0, mon = 10) => new Date(2026, mon, d, h, m, 0);
const id = (n: number) => `${String(n).padStart(8, "0")}-1111-4222-8333-444444444444`;
type Row = ReturnType<typeof order> & Record<string, unknown>;
const del = (n: number, when: Date, paid: "cash" | "upi_door", paise: number, handed: boolean): Row =>
  ({ ...order("delivered", when.toISOString(), new Date(when.getTime() - 1800_000).toISOString()), id: id(n), rider_id: SESSION, delivered_at: when.toISOString(), paid_by: paid, total_paise: paise, cash_handed_at: paid === "cash" && handed ? at(when.getDate(), 23).toISOString() : null }) as Row;

// 7 past days (7 to 13 Nov), 157 each = 1,099 rows, half cash (handed), half UPI. Today 14 Nov: one cash. Two cash orders of 20 Oct, never handed.
const PER_DAY = 157;
const ROWS: Row[] = [];
let n = 1;
for (let d = 7; d <= 13; d++) for (let i = 0; i < PER_DAY; i++) ROWS.push(del(n++, at(d, 10 + (i % 10), i % 60), i % 2 ? "upi_door" : "cash", 10000, true));
ROWS.push(del(n++, at(14, 12), "cash", 34000, false));
ROWS.push(del(n++, at(20, 12, 0, 9), "cash", 25000, false), del(n++, at(20, 13, 0, 9), "cash", 20000, false));
const LIVE: Row = { ...order("ready", at(13, 23, 40).toISOString(), at(13, 23, 30).toISOString()), id: id(9999), rider_id: SESSION } as Row;   // placed before midnight, still open after it
const cashOf = (d: number) => ROWS.filter((o) => new Date(o.delivered_at as string).getDate() === d && new Date(o.delivered_at as string).getMonth() === 10 && o.paid_by === "cash").length * 10000;

const peek = (o: Row, clause: string) => new Date(/updated_at\.gte\.([^,]+)/.exec(clause)?.[1] ?? "").getTime();
test("PD-1496 a rider with 1,100+ rows: every day in range is full, old cash is there, a live job from before midnight stays", async ({ page, context }) => {
  await page.clock.install({ time: at(14, 15) });
  const net = await setup(context, page, [...ROWS, LIVE]);
  net.state.pastDays = 7;
  const all = [...ROWS, LIVE].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  await page.route("**/rest/v1/orders*", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.fallback();
    let rows = all;
    const or = url.searchParams.get("or");
    if (or) {   // the rider's filter: updated_at from a date, or still live, or delivered cash not handed over
      const from = peek(rows[0], or);
      rows = rows.filter((o) => Date.parse(o.updated_at) >= from || !["delivered", "cancelled"].includes(o.status) || (o.status === "delivered" && !o.cash_handed_at && (!o.paid_by || o.paid_by === "cash")));
    }
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);   // PostgREST max-rows
    return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(rows.slice(offset, offset + limit)) });
  });
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Pick up" })).toBeVisible();   // the live job from before midnight
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("older-cash")).toContainText("₹450");
  await page.getByRole("button", { name: /^Pichhle din/ }).click();
  const days = page.getByTestId("past-day");
  await expect(days).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    const d = 13 - i;
    await expect(days.nth(i)).toContainText(`${PER_DAY} delivery`);
    await expect(days.nth(i)).toContainText(`Cash ₹${cashOf(d) / 100}`);
  }
});
