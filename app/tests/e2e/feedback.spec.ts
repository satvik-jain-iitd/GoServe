// Story S-B (#94), changed by story 1751 (epic #1299): the Feedback sheet saves through the database function feedback_save_v2, not the old webhook. The network is answered by the test (see helpers.ts).
// Words only for now: the picture picker is gone for every role until the picture story.
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const openFeedback = async (page: Page) => {   // #242: the floating button lives on the console; the kitchen tab there shows the session's orders
  await page.goto("/console/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByRole("button", { name: "Cooking", exact: true }).click();   // H11: an accepted ticket is on the Cooking tab
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  await page.getByRole("button", { name: "Start 0f0f0f0f" }).click();   // one tap so the trail has something in it
  await page.getByRole("button", { name: "Feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
};

test("S1 AC-1 a report: the function is called once with the words, the kind of work, the screen, the order and the trail; the sheet says it was sent", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  await page.getByLabel("What happened?").fill("Accept button did nothing");
  await page.getByLabel("What were you doing?").selectOption("Cooking");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toHaveCount(0);   // story #642: the sheet closes
  const card = page.getByTestId("feedback-sent");
  await expect(card).toContainText("Sent. Thank you.");
  await expect(card).toContainText("The GoServe team reads every note. Yours makes the app better for everyone.");
  expect(net.calls.feedback).toHaveLength(1);
  const b = net.calls.feedback[0].body;
  expect(b).toMatchObject({ p_role: "console", p_screen: "/console/ (kitchen tab)", p_order: ID, p_doing: "cooking", p_text: "Accept button did nothing" });
  expect(b.p_context.trail.map((t: { line: string }) => t.line).join(" ")).toMatch(/preparing/);
  expect("session_id" in b || "p_session" in b || "image_b64" in b).toBe(false);   // the server takes the person from the sign-in; no picture yet
});

test("S2 the sheet has no picture picker, for any role (words only for now)", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  await expect(page.getByLabel("Add a screenshot")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("S3 AC-2 an offline report waits on the phone and is sent through the function when the phone is back online; the queue is then empty", async ({ page, context }) => {
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
  expect(net.calls.feedback[0].body.p_text).toBe("Lost signal in the kitchen");
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("gs-feedback-queue") ?? "[]").length)).toBe(0);
});

test("S4 AC-3 too many reports: one true line, the sheet stays open with the typed words", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await openFeedback(page);
  net.state.feedbackReply = { ok: false, error: "too_many", message: "You have sent a lot of notes. Try again in an hour." };
  await page.getByLabel("What happened?").fill("Nothing happens on Pay");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert")).toHaveText("You have sent a lot of notes. Try again in an hour.");
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toHaveValue("Nothing happens on Pay");
  await expect(page.getByTestId("feedback-sent")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
});

test("S5 AC-4 nothing is posted to the old webhook for feedback any more", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  const hooks: string[] = [];
  page.on("request", (r) => { if (r.url().startsWith("https://orders.test/") && (r.postData() ?? "").includes('"feedback"')) hooks.push(r.url()); });
  await openFeedback(page);
  await page.getByLabel("What happened?").fill("Words for the database");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("feedback-sent")).toContainText("Sent. Thank you.");
  expect(hooks).toHaveLength(0);
  expect(net.calls.feedback).toHaveLength(1);
});

for (const [path, role, sent] of [["/customer/", "customer", "customer"], ["/kitchen/", "kitchen", "kitchen"], ["/rider/", "rider", "rider"], ["/admin/", "admin", "ops"]] as const) {
  test(`S6 AC-6 the ${role} app sends through the function with its own role`, async ({ page, context }) => {
    const net = await setup(context, page, [order("accepted")]);
    net.state.kitchen = "k-1";
    net.state.admin = true;
    await page.goto(path);
    await page.evaluate(() => window.dispatchEvent(new Event("gs-feedback")));   // the Send feedback row on the You page does the same
    await page.getByLabel("What happened?").fill(`A note from the ${role}`);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("feedback-sent")).toContainText("Sent. Thank you.");
    expect(net.calls.feedback).toHaveLength(1);
    expect(net.calls.feedback[0].body).toMatchObject({ p_role: sent, p_text: `A note from the ${role}` });
  });
}

test("the floating button is on the console only; the role apps carry a Send feedback row instead (story #242)", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/console/");
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
