// Story #251: the download page shows the latest APK, its version and date, and a QR that opens it. The GitHub API is answered by the test.
import { test, expect } from "@playwright/test";

const RELEASE = {
  tag_name: "v1.2.0", published_at: "2026-10-26T09:30:00Z",
  assets: [
    { name: "goserve-1.2.0.apk", browser_download_url: "https://github.com/x/y/releases/download/v1.2.0/goserve-1.2.0.apk" },
    { name: "goserve-qr.png", browser_download_url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" },
  ],
};

test("S1 the page links the latest APK with its version and date, and shows the QR", async ({ page }) => {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(RELEASE) }));
  await page.goto("/get/");
  const link = page.getByRole("link", { name: /Download GoServe 1\.2\.0/ });
  await expect(link).toHaveAttribute("href", "https://github.com/x/y/releases/download/v1.2.0/goserve-1.2.0.apk");
  await expect(page.getByText("26 Oct 2026")).toBeVisible();
  await expect(page.getByRole("img", { name: "QR code for the download" })).toBeVisible();
});

test("S2 when the release cannot be read the page says so and gives the releases page", async ({ page }) => {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 404, body: "{}" }));
  await page.goto("/get/");
  await expect(page.getByText("No app is published yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "All releases" })).toBeVisible();
});
