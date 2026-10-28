// Story S-B (#94): the Feedback button. The network is answered by the test (see helpers.ts); the real save, Drive file and Telegram message are checked live.
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

// A 1x1 PNG: the "screenshot" the tester picks.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const openFeedback = async (page: Page) => {   // #242: the floating button lives on the console; the kitchen tab there shows the session's orders
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
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
  await expect(page.getByRole("dialog", { name: "Feedback" })).toHaveCount(0);   // story #642: the sheet closes
  const card = page.getByTestId("feedback-sent");
  await expect(card).toContainText("Sent. Thank you.");
  await expect(card).toContainText("The GoServe team reads every note. Yours makes the app better for everyone.");
  expect(net.calls.feedback).toHaveLength(1);
  const sent = net.calls.feedback[0];
  expect(sent.headers["x-gs-token"]).toBe("demo-token");
  expect(sent.body).toMatchObject({ action: "feedback", role: "console", screen: "/ (kitchen tab)", order_id: ID, doing: "cooking", text: "Accept button did nothing" });
  expect(sent.body.image_b64.length).toBeGreaterThan(20);
  expect(sent.body.context.trail.map((t: { line: string }) => t.line).join(" ")).toMatch(/preparing/);
});

test("S2 a report without a screenshot sends no picture", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  await page.getByLabel("What happened?").fill("The card is hard to read");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("feedback-sent")).toContainText("Sent. Thank you.");
  expect("image_b64" in net.calls.feedback[0].body).toBe(false);
});

test("S3 an offline report waits on the phone and is sent when the phone is back online", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  net.state.feedbackDown = true;
  await page.getByLabel("What happened?").fill("Lost signal in the kitchen");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toHaveCount(0);
  const saved = page.getByTestId("feedback-sent");
  await expect(saved).toContainText("Saved on this phone.");
  await expect(saved).toContainText("It goes to the team the moment you are back online.");
  expect(net.calls.feedback).toHaveLength(0);
  net.state.feedbackDown = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => net.calls.feedback.length).toBe(1);
  expect(net.calls.feedback[0].body.text).toBe("Lost signal in the kitchen");
});

test("S4 a server failure keeps the sheet open with the words and the file, shows the error and lets the customer send again (story #642)", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  net.state.reply = { status: 500, body: { ok: false, error: "server", message: "We could not send that. Please try again." } };
  await page.getByLabel("What happened?").fill("Nothing happens on Pay");
  await page.getByLabel("Add a screenshot").setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not send the note. Try again.");
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveValue("Nothing happens on Pay");
  await expect(page.getByTestId("feedback-sent")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
});

test("the floating button is on the console only; the role apps carry a Send feedback row instead (story #242)", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Feedback", exact: true })).toBeVisible();
  for (const path of ["/customer/", "/kitchen/", "/rider/"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Feedback", exact: true })).toHaveCount(0);
  }
});

// Story #636 (row T3): the native select draws its chevron in the page's colour scheme; on Night it stayed black. The select takes the dark scheme on Night.
for (const theme of ["day", "night"]) {
  test(`S-636 ${theme}: the Feedback select follows the theme's colour scheme`, async ({ page, context }) => {
    await context.addInitScript((t) => { try { localStorage.setItem("gs-theme", t); } catch { /* the default theme shows */ } }, theme);
    const net = await setup(context, page, [order("accepted")]);
    net.state.kitchen = "k-1";
    await openFeedback(page);
    const scheme = await page.getByLabel("What were you doing?").evaluate((el) => getComputedStyle(el).colorScheme);
    if (theme === "night") expect(scheme).toContain("dark");
    else expect(scheme).not.toContain("dark");
  });
}
