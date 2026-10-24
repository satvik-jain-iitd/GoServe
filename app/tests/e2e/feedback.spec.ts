// Story S-B (#94): the Feedback button. The network is answered by the test (see helpers.ts); the real save, Drive file and Telegram message are checked live.
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

// A 1x1 PNG: the "screenshot" the tester picks.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const openFeedback = async (page: Page) => {
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();   // H11: an accepted ticket is on the Cooking tab
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  await page.getByRole("button", { name: "Start 0f0f0f0f" }).click();   // one tap so the trail has something in it
  await page.getByRole("button", { name: "Feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
};

test("S1 a report with a screenshot: words, kind of work, order, trail and picture reach the server", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  await page.getByLabel("What happened?").fill("Accept button did nothing");
  await page.getByLabel("What were you doing?").selectOption("cooking");
  await page.getByLabel("Add a screenshot").setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks, saved.")).toBeVisible();
  expect(net.calls.feedback).toHaveLength(1);
  const sent = net.calls.feedback[0];
  expect(sent.headers["x-gs-token"]).toBe("demo-token");
  expect(sent.body).toMatchObject({ action: "feedback", role: "kitchen", screen: "/kitchen/", order_id: ID, doing: "cooking", text: "Accept button did nothing" });
  expect(sent.body.image_b64.length).toBeGreaterThan(20);
  expect(sent.body.context.trail.map((t: { line: string }) => t.line).join(" ")).toMatch(/preparing/);
});

test("S2 a report without a screenshot sends no picture", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  await page.getByLabel("What happened?").fill("The card is hard to read");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks, saved.")).toBeVisible();
  expect("image_b64" in net.calls.feedback[0].body).toBe(false);
});

test("S3 an offline report waits on the phone and is sent when the phone is back online", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  net.state.feedbackDown = true;
  await page.getByLabel("What happened?").fill("Lost signal in the kitchen");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Saved on this phone. It will send when you are back online.")).toBeVisible();
  expect(net.calls.feedback).toHaveLength(0);
  net.state.feedbackDown = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => net.calls.feedback.length).toBe(1);
  expect(net.calls.feedback[0].body.text).toBe("Lost signal in the kitchen");
});

test("the button is on the console and on every role app", async ({ page, context }) => {
  await setup(context, page);
  for (const path of ["/", "/customer/", "/kitchen/", "/rider/", "/ops/"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Feedback" })).toBeVisible();
  }
});
