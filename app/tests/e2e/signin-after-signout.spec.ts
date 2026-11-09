// Story #842: after a Google return the address is /customer/#. The button must not pass that "#" on, or GoTrue returns "##access_token=" and the sign-in is lost.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

for (const [app, path] of [["customer", "/customer/#"], ["kitchen", "/kitchen/#"]] as const) {
  test(`S1 ${app}: Continue with Google from ${path} sends a redirect_to without "#"`, async ({ page, context }) => {
    const net = await setup(context, page, [], { guest: true });
    net.state.rider = null;
    const authorize: string[] = [];
    await context.route(/test\.supabase\.co\/auth\/v1\/authorize/, (r) => { authorize.push(r.request().url()); return r.fulfill({ status: 200, contentType: "text/html", body: "<p>Google</p>" }); });
    await page.goto(path);
    await page.getByTestId("google-signin").click();
    await expect.poll(() => authorize.length).toBe(1);
    const u = new URL(authorize[0]);
    expect(u.searchParams.get("redirect_to"), "no fragment in the return address").not.toContain("#");
    if (app === "kitchen") expect(u.searchParams.get("prompt")).toBe("select_account");
  });
}
