// Story #661 (copy audit G.11, H.3, H.4, J.3): the words on You and in the Feedback sheet, and the contact address on the legal pages.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const openSheet = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("gs-feedback")));

test("S1 the Send feedback row says what happens on tap", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "You" }).click();
  await expect(page.getByText("Two lines and a screenshot. We read every note.")).toBeVisible();
});

test("S2 the customer's Feedback list is the four customer choices, Something else picked", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await openSheet(page);
  const pick = page.getByLabel("What were you doing?");
  expect(await pick.locator("option").allTextContents()).toEqual(["Ordering", "Tracking my order", "Paying the rider", "Something else"]);
  await expect(pick).toHaveValue("Something else");
  await expect(page.getByText("Add a screenshot (optional)")).toBeVisible();
  await expect(page.getByText("Take one with your phone buttons first, then pick it here.")).toBeVisible();
});

test("S3 the kitchen app keeps the full list with nothing picked", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await openSheet(page);
  const pick = page.getByLabel("What were you doing?");
  expect(await pick.locator("option").allTextContents()).toEqual(["", "Ordering", "Cooking", "Delivering", "Watching ops", "Installing", "Other"]);
  await expect(pick).toHaveValue("");
});

test("S4 a customer's pick goes out as a stored kind and as the words the customer chose", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/customer/");
  await openSheet(page);
  await page.getByLabel("What happened?").fill("The bill looks wrong");
  await page.getByLabel("What were you doing?").selectOption("Paying the rider");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("feedback-sent")).toBeVisible();
  expect(net.calls.feedback[0].body).toMatchObject({ doing: "delivering" });
  expect(net.calls.feedback[0].body.context.topic).toBe("Paying the rider");
});

test("S5 the privacy and terms pages carry the new contact address", async ({ page }) => {
  for (const path of ["/privacy/", "/terms/"]) {
    await page.goto(path);
    await expect(page.getByText("avinturetech@gmail.com").first()).toBeVisible();   // #771: the privacy page names it in the delete section too
    await expect(page.locator("body")).not.toContainText("klickbae8yt@gmail.com");
  }
});
