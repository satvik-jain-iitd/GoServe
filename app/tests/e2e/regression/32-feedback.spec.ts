// Regression, screen 32: Feedback sheet. Cases: .claude/handoff/qa/screens/32-Feedback.md (epic #1196, story #1197). Reached with the shared step STEPS["account"] (You), then Send feedback.
// The order webhook is answered by the test after the shared step (a later route wins): it records each feedback report, and can drop the network for Send.
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
type Sent = { action: string; role: string; text: string; doing: string };

// Reach You with the shared step, then answer the webhook's feedback action: keep each report, or drop the network.
async function reach(context: BrowserContext, page: Page) {
  await STEPS["account"](context, page, PATH);
  const sent: Sent[] = [];
  const net = { down: false };
  await context.route("https://orders.test/**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? "{}");
    if (body.action !== "feedback") return route.fallback();
    if (net.down) return route.abort("internetdisconnected");
    sent.push(body);
    return route.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ ok: true, id: "f1" }) });
  });
  return { sent, net };
}

const dialog = (page: Page) => page.getByRole("dialog", { name: "Feedback" });
const sendBtn = (page: Page) => dialog(page).getByRole("button", { name: "Send", exact: true });

async function openSheet(page: Page) {
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(dialog(page)).toBeVisible();
}

test("TC 32.1 Look: Feedback, What happened? box with an e.g. example, What were you doing? list, Add a screenshot (optional), Send, Close", async ({ page, context }) => {
  await reach(context, page);
  await openSheet(page);
  await expect(dialog(page).getByRole("heading", { name: "Feedback", exact: true })).toBeVisible();
  await expect(dialog(page).getByLabel("What happened?")).toBeVisible();
  const topics = dialog(page).getByLabel("What were you doing?");
  await expect(topics).toBeVisible();
  await expect(topics.getByRole("option")).toHaveText(["Ordering", "Tracking my order", "Paying the rider", "Something else"]);
  await expect(dialog(page).getByLabel("Add a screenshot (optional)")).toBeVisible();
  await expect(sendBtn(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Close", exact: true })).toBeVisible();
  test.fail(true, "#1231: the What happened? box has no e.g. example text (no placeholder)");
  await expect(dialog(page).getByLabel("What happened?")).toHaveAttribute("placeholder", /e\.g\./i);
});

test("TC 32.2 Type two lines, Send: the thank-you state shows and the note reaches the team's list", async ({ page, context }) => {
  const { sent } = await reach(context, page);
  await openSheet(page);
  const words = "The menu did not load\nIt kept spinning for a minute";
  await dialog(page).getByLabel("What happened?").fill(words);
  await sendBtn(page).click();
  await expect(dialog(page)).toHaveCount(0);
  const thanks = page.getByRole("status").filter({ hasText: "Sent. Thank you." });
  await expect(thanks).toBeVisible();
  await expect(thanks).toContainText("The GoServe team reads every note.");
  await expect.poll(() => sent.length).toBe(1);   // the report reached the server
  expect(sent[0]).toMatchObject({ action: "feedback", role: "customer", text: words, doing: "other" });
});

test("TC 32.3 Send with an empty box: Send is grey and a reason line shows", async ({ page, context }) => {
  const { sent } = await reach(context, page);
  await openSheet(page);
  await expect(dialog(page).getByLabel("What happened?")).toHaveValue("");
  await expect(sendBtn(page)).toBeVisible();   // proves the button shows before its state is checked
  test.fail(true, "#1233: the reason line shows only after Send is pressed, not with the box empty");
  await expect(dialog(page).getByRole("alert")).toHaveText("Please tell us what happened.");
  expect(sent).toHaveLength(0);
  await expect(dialog(page)).toBeVisible();   // the sheet stays open to be fixed
  test.fail(true, "#1233: Send is never greyed out: it stays filled with an empty box");
  await expect(sendBtn(page)).toBeDisabled();
});

test("TC 32.5 No network on Send: our own line shows and the note is kept on the phone, then sent when back online", async ({ page, context }) => {
  const { sent, net } = await reach(context, page);
  net.down = true;
  await openSheet(page);
  await dialog(page).getByLabel("What happened?").fill("Lost signal at the door");
  await sendBtn(page).click();
  await expect(dialog(page)).toHaveCount(0);
  const saved = page.getByRole("status").filter({ hasText: "Saved on this phone." });
  await expect(saved).toContainText("It goes to the team the moment you are back online.");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("gs-feedback-queue") ?? "")).toContain("Lost signal at the door");   // kept, not lost
  expect(sent).toHaveLength(0);
  net.down = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].text).toBe("Lost signal at the door");
});
