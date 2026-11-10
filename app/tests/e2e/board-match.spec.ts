// Story #1168 (owner, 9 Nov): Playwright drives the customer app screen by screen and matches each screen to its approved board: text and role, boxes within 4 px, order, font, colour.
// The report (test-results/board-match/index.html) shows the board and the app side by side with the mismatches outlined in red. It runs as its own CI job (BOARD_MATCH=1), not as a merge gate yet.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compare, measure, writeReport, type Verdict } from "./boardMatch";
import { NINE, STEPS } from "./screensSteps";
import { setup } from "./helpers";

const OUT = resolve(import.meta.dirname, "../../test-results/board-match");
type Reach = (context: BrowserContext, page: Page) => Promise<void>;
const via = (step: string): Reach => async (context, page) => { await STEPS[step](context, page, "/customer/"); };

// Journey order. Each screen: its board, how the app gets there (the same steps as the screen pictures), and the sample words that differ from the board's (a dish, a price, an address).
const SCREENS: { board: string; reach: Reach; alias?: Record<string, string | string[]>; note?: string }[] = [
  { board: "O0g-C-GoogleBottom", reach: via("welcome") },
  { board: "N0b-AlertsBottom", reach: via("alerts-ask") },
  { board: "A1c-LocationManual", reach: via("first-open-ask") },
  { board: "C8-SearchResults", reach: via("deliver-to-search") },
  { board: "C7a-ExampleInside", reach: via("pin-details") },
  { board: "C1-HomeTop", reach: via("menu") },
  { board: "F1-Filter", reach: async (c, p) => { await via("menu")(c, p); await p.getByRole("button", { name: "Filter the menu" }).click(); await expect(p.getByRole("dialog")).toBeVisible(); } },
  { board: "L4d-ClosedGreyMenu", reach: async (c, p) => { const net = await setup(c, p); (net.state.kitchens[0] as { open?: boolean }).open = false; await p.goto("/customer/"); await expect(p.getByText(/^Kitchen closed/).first()).toBeVisible(); } },
  { board: "C2-AddressSheet", reach: via("deliver-to") },
  { board: "D2-BillNote", reach: via("bill") },
  { board: "P1-BillCash", reach: via("bill") },
  { board: "Y4b-YouPageCards", reach: via("account") },
  { board: "H1-History", reach: via("orders") },
];

// Not serial: a failing screen must not skip the others. Tests of one file run in order, so the last afterAll sees every screen's result.
test.beforeAll(() => { mkdirSync(OUT, { recursive: true }); });
test.afterAll(() => { console.log(`board-match report: ${writeReport(OUT)}`); });

for (const s of SCREENS) {
  test(`board ${s.board}`, async ({ page, context }) => {
    await page.clock.install({ time: NINE });
    await page.setViewportSize({ width: 390, height: 844 });
    await s.reach(context, page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(OUT, `${s.board}.png`) });
    const v: Verdict = compare(s.board, await measure(page), s.alias);
    if (s.note) v.note = s.note;
    writeFileSync(resolve(OUT, `${s.board}.json`), JSON.stringify(v));
    expect(v.failures, `${s.board}: ${v.failures.length} mismatches, see test-results/board-match/index.html`).toEqual([]);
  });
}
