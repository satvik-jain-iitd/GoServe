// Story 1563: Share this note sends the co-founder's letter as one picture. Shared by the Chromium and the WebKit spec.
// The phone's share sheet is a stand-in that records what it got. The picture is decoded and measured here, pixel by pixel.
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setup, typePlace } from "./helpers";

const SCALE = 2;          // the picture is made at 2x
const LOOK_LIMIT = 0.01;  // the look test: at most 1 percent of the pixels may differ (pixelmatch threshold 0.2). Measured: Chromium 0.000, WebKit 0.301 percent; a fallback font 4.8 percent
type Mode = { files: boolean; abort?: boolean; canvas?: "hang" | "throw" };
type Shared = { title?: string; text?: string; url?: string; files: { name: string; type: string; size: number; data: string }[] };
type Img = { width: number; height: number; data: Buffer };
type Box = { x: number; y: number; width: number; height: number };

// The PNG reader and the pixelmatch that ship with Playwright (the ones toHaveScreenshot uses). They have no types of their own.
const lib = createRequire(import.meta.url);
const { PNG } = lib("playwright-core/lib/utilsBundle") as { PNG: { new (o: { width: number; height: number }): Img; bitblt(src: Img, dst: Img, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void; sync: { read(b: Buffer): Img; write(i: Img): Buffer } } };
const { utils } = lib("playwright-core/lib/coreBundle") as { utils: { getComparator(mime: string): (a: Buffer, b: Buffer, o: { maxDiffPixels: number; threshold: number }) => { errorMessage: string } | null } };

// The stand-in for the phone: navigator.share and navigator.canShare record what was passed. `canvas` makes the picture hang or fail.
async function phone(page: Page, mode: Mode) {
  await page.addInitScript((m) => {
    const w = window as unknown as { __shares: unknown[] };
    w.__shares = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (d?: ShareData) => m.files && !!d?.files?.length });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d: ShareData) => {
      const files = await Promise.all((d.files ?? []).map((f) => new Promise((done) => {
        const r = new FileReader();
        r.onload = () => done({ name: f.name, type: f.type, size: f.size, data: String(r.result).split(",")[1] });
        r.readAsDataURL(f);
      })));
      w.__shares.push({ title: d.title, text: d.text, url: d.url, files });
      if (m.abort) throw new DOMException("The share sheet was closed", "AbortError");
    } });
    if (m.canvas === "hang") HTMLCanvasElement.prototype.toBlob = () => { /* never answers */ };
    if (m.canvas === "throw") HTMLCanvasElement.prototype.toBlob = HTMLCanvasElement.prototype.toDataURL = () => { throw new DOMException("Tainted canvases may not be exported.", "SecurityError"); };   // what a tainted canvas does
  }, mode);
}

async function toNote(page: Page, height = 844) {
  await page.setViewportSize({ width: 390, height });
  await page.goto("/customer/");
  await typePlace(page, "110099", "Sector 62, Sampletown, Sample State 900001");
  await page.getByRole("button", { name: "Tell me when you come here" }).click();
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();
}
const slip = (page: Page) => page.getByRole("group", { name: "A letter from co-founder Satvik Jain" });
const shareButton = (page: Page) => page.locator(".ui-founder-share");
const shares = (page: Page) => page.evaluate(() => (window as unknown as { __shares: Shared[] }).__shares);
const shared = async (page: Page, count = 1) => { await expect.poll(async () => (await shares(page)).length, { timeout: 15_000 }).toBe(count); return shares(page); };

const crop = (img: Img, b: Box): Img => {
  const out = new PNG({ width: Math.round(b.width), height: Math.round(b.height) });
  PNG.bitblt(img, out, Math.round(b.x), Math.round(b.y), out.width, out.height, 0, 0);
  return out;
};
// How many pixels differ between two pictures of the same size, as a share of all of them.
function differ(a: Img, b: Img) {
  expect([a.width, a.height], "the two pictures have the same size").toEqual([b.width, b.height]);
  const r = utils.getComparator("image/png")(PNG.sync.write(a), PNG.sync.write(b), { maxDiffPixels: 0, threshold: 0.2 });
  const count = r ? Number(/(\d+) pixels/.exec(r.errorMessage)?.[1]) : 0;
  expect(count, r?.errorMessage).not.toBeNaN();
  return count / (a.width * a.height);
}
// The box of a part of the letter inside the picture, in picture pixels.
const boxIn = (page: Page, sel: string) => page.evaluate(([s, k]) => {
  const n = document.querySelector(".ui-slip.ui-founder")!.getBoundingClientRect(), e = document.querySelector(s as string)!.getBoundingClientRect();
  return { x: (e.x - n.x) * (k as number), y: (e.y - n.y) * (k as number), width: e.width * (k as number), height: e.height * (k as number) };
}, [sel, SCALE] as const);
const shot = async (page: Page) => PNG.sync.read(await slip(page).screenshot({ animations: "disabled" }));

// Read off the picture itself, under the signature: the only ink there is one line (the address), 24 px under the signature and 24 px above the picture's end.
// So the links line and the buttons are not in the picture and there is no blank band. Ink is any pixel that is not paper; the border at the edges is left out.
// The letters are smaller than their line, so the gaps by ink may be up to 4 px more than 24.
async function measure(page: Page, png: Img) {
  const sign = await boxIn(page, ".ui-founder-sign");
  const from = Math.round(sign.y + sign.height), edge = 3 * SCALE;
  const px = (x: number, y: number) => png.data.subarray((y * png.width + x) * 4, (y * png.width + x) * 4 + 3);
  const paper = px(edge, from);
  const rows: number[] = [];
  for (let y = from; y < png.height - edge; y++)
    for (let x = edge; x < png.width - edge; x++) { const c = px(x, y); if (Math.abs(c[0] - paper[0]) + Math.abs(c[1] - paper[1]) + Math.abs(c[2] - paper[2]) > 60) { rows.push(y); break; } }
  expect(rows.length, "the address line is printed under the signature").toBeGreaterThan(4 * SCALE);
  const first = rows[0], last = rows[rows.length - 1] + 1;
  expect(last - first, `one line of ink under the signature (rows ${first} to ${last}): no links line, no button`).toBeLessThanOrEqual(14 * SCALE);
  const above = first - from, under = png.height - last;
  expect(above, `the gap above the address line is ${above / SCALE}px`).toBeGreaterThanOrEqual(24 * SCALE - 1);
  expect(above, `the gap above the address line is ${above / SCALE}px`).toBeLessThanOrEqual(28 * SCALE);
  expect(under, `the picture ends ${under / SCALE}px under the address line`).toBeGreaterThanOrEqual(24 * SCALE - 1);
  expect(under, `the picture ends ${under / SCALE}px under the address line`).toBeLessThanOrEqual(28 * SCALE);
  return { above, under };
}

export function shareLetter(engine: string) {
  test.use({ deviceScaleFactor: SCALE });   // the screen is 2x, as the picture, so the two are laid over each other pixel on pixel

  test("The letter goes as a picture: one PNG file, no text, the whole letter, no share button, the address at its foot", async ({ page, context }) => {
    await phone(page, { files: true });
    await setup(context, page, [], { pin: null });
    await toNote(page, 560);   // a short phone: the letter needs a scroll, and the slip on the screen is shorter than its words
    await shareButton(page).click();
    const [d] = await shared(page);
    expect(d.files.length, "one file").toBe(1);
    expect([d.text, d.url, d.title], "no text, no link and no title go with the file").toEqual([undefined, undefined, undefined]);
    expect(d.files[0].type).toBe("image/png");
    expect(d.files[0].name).toMatch(/\.png$/);
    expect(d.files[0].size, "under 1 MB").toBeLessThan(1_000_000);

    const png = PNG.sync.read(Buffer.from(d.files[0].data, "base64"));
    if (process.env.LETTER_OUT) writeFileSync(`${process.env.LETTER_OUT}/letter-short-${engine}.png`, Buffer.from(d.files[0].data, "base64"));
    const size = await slip(page).evaluate((el) => ({ w: el.getBoundingClientRect().width, box: el.getBoundingClientRect().height, page: el.closest(".ui-landing")!.scrollHeight, screen: window.innerHeight }));
    expect(size.page, "the letter needs a scroll on this phone").toBeGreaterThan(size.screen);
    expect(png.width).toBe(Math.round(size.w * SCALE));
    expect(png.width, "the letter's own width at 2x").toBeGreaterThanOrEqual(700);
    const m = await measure(page, png);
    console.log(`measured ${engine}, short phone: ${png.width}x${png.height}px, ${d.files[0].size} bytes, gap above the address ${m.above / SCALE}px, under it ${m.under / SCALE}px`);
    expect(png.height, "the whole letter: the picture is longer than the slip on the screen").toBeGreaterThan(size.box * SCALE);

    await expect(page.locator(".ui-founder-foot")).toHaveText("letsdwelo.in");
    await expect(page.locator(".ui-founder-foot")).toBeHidden();      // the screen does not change: the foot line is printed on the picture only,
    await expect(page.locator(".ui-founder-links")).toBeVisible();    // and the links line stays on the screen
  });

  test("The picture looks like the screen: under the set limit, and the brand font is used", async ({ page, context }, info) => {
    await phone(page, { files: true });
    await setup(context, page, [], { pin: null });
    await toNote(page);
    await page.evaluate(() => document.fonts.ready);
    const t0 = Date.now();
    await shareButton(page).click();
    const [d] = await shared(page);
    const ms = Date.now() - t0;
    const png = PNG.sync.read(Buffer.from(d.files[0].data, "base64"));
    if (process.env.LETTER_OUT) writeFileSync(`${process.env.LETTER_OUT}/letter-${engine}.png`, Buffer.from(d.files[0].data, "base64"));

    for (const f of ["800 22px 'Bricolage Grotesque'", "15px 'Anek Latin'", "600 34px 'Caveat'", "12px 'DM Mono'"])
      expect(await page.evaluate((font) => document.fonts.check(font), f), `${f} is loaded`).toBe(true);
    const m = await measure(page, png);

    // The letter from the top to the end of the signature: the same in the picture and on the screen.
    const sign = await boxIn(page, ".ui-founder-sign");
    const top = { x: 0, y: 0, width: png.width, height: Math.round(sign.y + sign.height) };
    const look = differ(crop(png, top), crop(await shot(page), top));

    // The whole picture: the screen is put in the picture's shape (buttons and links line out, the address line shown, no stretch) and the two are laid over each other.
    await page.evaluate(() => {
      const letter = document.querySelector<HTMLElement>(".ui-slip.ui-founder")!;
      letter.querySelectorAll<HTMLElement>("button, .ui-founder-links").forEach((b) => { b.style.display = "none"; });
      letter.querySelector<HTMLElement>(".ui-founder-foot")!.hidden = false;
      Object.assign(letter.style, { flex: "none", height: "auto" });
    });
    const foot = await boxIn(page, ".ui-founder-foot");
    const shaped = await shot(page);
    const gaps = [foot.y - (sign.y + sign.height), shaped.height - (foot.y + foot.height)];   // by the boxes, in picture pixels; the letter's height is not a whole pixel and the screenshot rounds it up, so 1 px of the screen is allowed
    expect(Math.abs(gaps[0] - 24 * SCALE), `the gap from the signature to the address line is ${gaps[0] / SCALE}px`).toBeLessThanOrEqual(2);
    expect(Math.abs(gaps[1] - 24 * SCALE), `the gap under the address line is ${gaps[1] / SCALE}px`).toBeLessThanOrEqual(2);
    expect(Math.abs(png.height - shaped.height), `the picture is ${png.height}px high, the letter in the picture's shape is ${shaped.height}px`).toBeLessThanOrEqual(1);
    const all = { x: 0, y: 0, width: png.width, height: Math.min(png.height, shaped.height) };
    const whole = differ(crop(png, all), crop(shaped, all));

    // The same letter with a fallback font on the screen: the picture must be far from it.
    await page.evaluate(() => document.querySelectorAll<HTMLElement>(".ui-founder, .ui-founder *").forEach((el) => { el.style.fontFamily = "serif"; }));   // a test stand-in for a font that did not load, set on the elements themselves
    const fallback = differ(crop(png, top), crop(await shot(page), top));
    const line = `${engine}: look ${(look * 100).toFixed(3)} percent, the whole picture ${(whole * 100).toFixed(3)} percent, a fallback font ${(fallback * 100).toFixed(2)} percent, ${png.width}x${png.height}px, ${d.files[0].size} bytes, gap above the address ${m.above / SCALE}px, under it ${m.under / SCALE}px (by ink; by the boxes ${gaps[0] / SCALE}px and ${gaps[1] / SCALE}px), tap to share sheet ${ms} ms`;
    info.annotations.push({ type: "measured", description: line });
    console.log(`measured ${line}`);
    expect(look, `the picture differs from the screen by ${(look * 100).toFixed(2)} percent`).toBeLessThan(LOOK_LIMIT);
    expect(whole, `the whole picture differs from the screen in its shape by ${(whole * 100).toFixed(2)} percent`).toBeLessThan(LOOK_LIMIT);
    expect(fallback, "the picture is not drawn in a fallback font").toBeGreaterThan(LOOK_LIMIT * 3);
  });

  test("A phone that cannot share a file: the text is shared as before", async ({ page, context }) => {
    await phone(page, { files: false });
    await setup(context, page, [], { pin: null });
    await toNote(page);
    await shareButton(page).click();
    const [d] = await shared(page);
    expect(d.files).toEqual([]);
    expect(d.text).toContain("We don't reach Sector 62 yet.");
    expect(d.text).toContain("Pahle banda, phir dhanda");
  });

  test("The shared text keeps the letter's lines: the title, each paragraph, the motto and the name on their own lines, one blank line between", async ({ page, context }) => {
    await phone(page, { files: false });
    await setup(context, page, [], { pin: null });
    await toNote(page);
    await shareButton(page).click();
    const [d] = await shared(page);
    const paras = d.text!.split("\n\n");
    expect(d.text, "never two blank lines, never a space at a line's end").not.toMatch(/\n\n\n| \n|\n /);
    expect(paras[0], "the letter's first line on the screen is the text's first line").toBe("A letter from co-founder Satvik Jain");
    expect(paras[1]).toBe("*You found us early. Thank you.*");
    expect(paras.slice(2, 6)).toEqual([
      "We don't reach Sector 62 yet. I am sorry you came all this way for nothing today.",
      "We are a small, new kitchen, and we are growing fast. You trusted us first. That means a lot to me.",
      "So here is my promise: the day we open in Sector 62, your first order is ₹100 off. We will message you.",
      "At GoServe we have one rule.",
    ]);
    expect(paras[6]).toBe("*Pahle banda, phir dhanda.*\nPeople first, business after.");
    expect(paras[7], "the name, as on the screen").toBe("Satvik");
    expect(paras[8], "the site's address is the last line").toBe("https://letsdwelo.in/");
    expect(paras.length).toBe(9);
    expect(d.text, "no star next to a space").not.toMatch(/\* | \*/);
    expect(d.url, "the address goes once, in the text").toBeUndefined();
    // No line is longer than one paragraph of the letter on the screen.
    const longest = Math.max(...await page.locator(".ui-founder-text p").allInnerTexts().then((all) => all.map((t) => t.length)));
    for (const line of d.text!.split("\n")) expect(line.length, line).toBeLessThanOrEqual(longest);
  });

  test("The words are the same as on the screen: every paragraph of the shared text is shown on the screen, in the same order", async ({ page, context }) => {
    await phone(page, { files: false });
    await setup(context, page, [], { pin: null });
    await toNote(page);
    await shareButton(page).click();
    const [d] = await shared(page);
    const flat = (t: string) => t.replace(/\s+/g, "");   // WebKit gives no space between the title's two sentences, so the words are compared without spaces
    // What the screen shows, part by part, top to bottom: the first line, the title, the paragraphs, the motto, the name, the address.
    const screen = (await page.locator(".ui-founder .ui-slip-head span, .ui-founder-top h2, .ui-founder-text p, .ui-founder-sign, .ui-founder-links a[href='https://letsdwelo.in/']").allInnerTexts()).map(flat);
    const paras = d.text!.split("\n\n").map((p) => flat(p.replaceAll("*", "")));
    expect(paras.length, "as many paragraphs as the screen has parts").toBe(screen.length);
    expect(paras.slice(0, -1), "the first line, the title, the paragraphs, the motto and the name are the screen's words, exactly").toEqual(screen.slice(0, -1));
    expect(paras.at(-1), "the address is the screen's address, as a full link").toBe(`https://${screen.at(-1)}/`);
  });

  test("The picture cannot be made (it fails): the text is shared as before and I see no error", async ({ page, context }) => {
    await phone(page, { files: true, canvas: "throw" });
    await setup(context, page, [], { pin: null });
    await toNote(page);
    await shareButton(page).click();
    const [d] = await shared(page);
    expect(d.files).toEqual([]);
    expect(d.text).toContain("Pahle banda, phir dhanda");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(shareButton(page)).toHaveText("Share this note");
  });

  test("The picture takes more than 5 seconds: the button says Preparing…, cannot be tapped twice, then the text is shared", async ({ page, context }) => {
    await phone(page, { files: true, canvas: "hang" });
    await setup(context, page, [], { pin: null });
    await toNote(page);
    await page.waitForTimeout(500);
    const t0 = Date.now();
    await shareButton(page).click();
    await expect(shareButton(page)).toHaveText("Preparing…");
    await expect(shareButton(page)).toBeDisabled();
    await shareButton(page).click({ force: true });   // a second tap does nothing
    expect(await shares(page), "nothing is shared while it is made").toEqual([]);
    const [d] = await shared(page);
    expect(Date.now() - t0, "the text goes after 5 seconds, not before").toBeGreaterThanOrEqual(4_900);
    expect(Date.now() - t0).toBeLessThan(8_000);
    expect(d.files).toEqual([]);
    expect(d.text).toContain("Pahle banda, phir dhanda");
    await expect(shareButton(page)).toHaveText("Share this note");
    await expect(shareButton(page)).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.waitForTimeout(300);
    expect((await shares(page)).length, "one share for two taps").toBe(1);
  });

  test("I close the share sheet: nothing is shown and the button works again", async ({ page, context }) => {
    await phone(page, { files: true, abort: true });
    await setup(context, page, [], { pin: null });
    await toNote(page);
    await shareButton(page).click();
    const [d] = await shared(page);
    expect(d.files.length, "the picture went to the sheet, and no text after it was closed").toBe(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(shareButton(page)).toHaveText("Share this note");
    await expect(shareButton(page)).toBeEnabled();
    await shareButton(page).click();
    const again = await shared(page, 2);
    expect(again[1].files.length).toBe(1);
  });
}
