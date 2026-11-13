// Story 1454 (board KC1, epic 1453): on Cooking, Start is an outline button and Ready stays filled, so a quick second tap is not mistaken;
// the Ready group says what the cook does now ("give to the rider").
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const B = "0b0b0b0b-0000-0000-0000-000000000000", C = "0c0c0c0c-0000-0000-0000-000000000000";
const cooking = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page, [order("accepted"), { ...order("preparing"), id: B }, { ...order("ready"), id: C }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
};
const look = (page: Page, name: string) => page.getByRole("button", { name }).evaluate((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { ghost: e.classList.contains("ghost"), bg: s.backgroundColor, w: Math.round(r.width), h: Math.round(r.height) }; });

test("KC1a given an Accepted ticket, its button Start is an outline button", async ({ page, context }) => {
  await cooking(page, context);
  expect((await look(page, "Start 0f0f0f0f")).ghost).toBe(true);
});

test("KC1b given a Cooking ticket, its button Ready is a filled button, the same size as Start", async ({ page, context }) => {
  await cooking(page, context);
  const [start, ready] = [await look(page, "Start 0f0f0f0f"), await look(page, "Ready 0b0b0b0b")];
  expect(ready.ghost).toBe(false);
  expect(ready.bg).not.toBe(start.bg);   // filled against outline
  expect([ready.w, ready.h]).toEqual([start.w, start.h]);
});

test("KC1c given a Ready ticket, the group title is Ready · give to the rider", async ({ page, context }) => {
  await cooking(page, context);
  await expect(page.getByRole("heading", { name: "Ready · give to the rider" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready · rider on the way" })).toHaveCount(0);
});
