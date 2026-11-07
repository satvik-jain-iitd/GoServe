// Story #921: dish photos shrink to WebP on the phone, are stored for a year, and the menu list reserves each photo box and loads the later ones lazily.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

// A 2400x1800 noisy picture made in the page itself, so it is big (a phone photo is 3 MB; this is a few hundred KB) and really decodes.
const bigPhoto = (page: Page) => page.evaluate(async () => {
  const c = document.createElement("canvas"); c.width = 2400; c.height = 1800;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${(i * 37) % 360} 70% ${30 + (i % 40)}%)`; g.fillRect((i * 97) % 2400, (i * 53) % 1800, 300, 220); }
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.95));
  return { name: "big.jpg", mimeType: "image/jpeg", base64: await new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(blob); }) };
});

test("S1 a big phone photo is uploaded as WebP, 800 px at most, under 60 KB, cached for a year", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  const f = await bigPhoto(page);
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await page.getByLabel("Dish name").fill("Dal Makhani");
  await page.getByLabel("Price (₹)").fill("220");
  await page.getByLabel("Photo").setInputFiles({ name: f.name, mimeType: f.mimeType, buffer: Buffer.from(f.base64, "base64") });
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect.poll(() => net.calls.uploadMeta.length).toBe(1);
  expect(net.calls.uploads[0]).toMatch(/\/menu\/k-1\/.+\.webp$/);
  const up = net.calls.uploadMeta[0];
  expect(up.body!.toString("latin1")).toMatch(/name="cacheControl"\r\n\r\n31536000/);   // storage-js sends the cache time as a form field for a file
  const at = up.body!.indexOf("RIFF");
  expect(at, "a WebP file (RIFF header) is in the upload").toBeGreaterThan(0);
  const body = up.body!.subarray(at, at + 8 + up.body!.readUInt32LE(at + 4));   // the RIFF length field gives the exact file size
  expect(body.length, "bytes").toBeLessThan(60 * 1024);
  expect(body.subarray(8, 12).toString("latin1")).toBe("WEBP");
  const size = await page.evaluate(async (b64) => { const bm = await createImageBitmap(await (await fetch("data:image/webp;base64," + b64)).blob()); return Math.max(bm.width, bm.height); }, body.toString("base64"));
  expect(size).toBe(800);
});

test("S2 a photo that cannot be decoded is uploaded as it is (refuse nothing)", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await page.getByLabel("Dish name").fill("Dal");
  await page.getByLabel("Price (₹)").fill("220");
  await page.getByLabel("Photo").setInputFiles({ name: "dish.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect.poll(() => net.calls.uploadMeta.length).toBe(1);
  expect(net.calls.uploads[0]).toMatch(/\.png$/);
  expect(net.calls.uploadMeta[0].body!.toString("latin1")).toMatch(/name="cacheControl"\r\n\r\n31536000/);
});

test("S3 the menu list gives every photo its box up front: width and height, async decoding, the first two eager, the rest lazy", async ({ page, context }) => {
  const net = await setup(context, page);
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  net.state.menu = [1, 2, 3, 4].map((n) => ({ id: `d${n}`, name: `Dish ${n}`, price_paise: 10000, image_url: `https://test.supabase.co/storage/v1/object/public/menu/k-1/${n}.webp`, image_credit: null }));
  await context.route("https://test.supabase.co/storage/v1/object/public/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.goto("/customer/");
  await expect(page.locator("img.ui-photo")).toHaveCount(4);
  const attrs = await page.locator("img.ui-photo").evaluateAll((els) => els.map((e) => ({ w: e.getAttribute("width"), h: e.getAttribute("height"), d: e.getAttribute("decoding"), l: e.getAttribute("loading") })));
  expect(attrs.map((a) => [a.w, a.h, a.d])).toEqual(Array(4).fill(["76", "76", "async"]));
  expect(attrs.map((a) => a.l)).toEqual(["eager", "eager", "lazy", "lazy"]);
});
