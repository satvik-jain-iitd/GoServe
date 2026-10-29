// Story #254: the Play feature graphic, 1024 by 500. Run: cp ops/play/feature-graphic.mjs app/fg.mjs; (cd app && node fg.mjs <out.png>); rm app/fg.mjs
// The look is the story page's: the cream page colour, the lockup, the one line. Only the brand lockup and fonts of app/public are used.
// It imports @playwright/test, so copy it into app/ to run it (node resolves packages from the script folder), then delete the copy.
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const pub = (p) => pathToFileURL(resolve("public", p)).href;
const out = process.argv[2] ?? "feature-graphic.png";
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: "Bricolage Grotesque"; src: url("${pub("fonts/bricolage-grotesque-latin-1.woff2")}"); font-weight: 200 800; }
@font-face { font-family: "Anek Latin"; src: url("${pub("fonts/anek-latin-latin-0.woff2")}"); font-weight: 100 800; }
html, body { margin: 0; width: 1024px; height: 500px; background: #E4E6D9; color: #263528; }
main { box-sizing: border-box; width: 1024px; height: 500px; padding: 56px 64px; display: flex; flex-direction: column; justify-content: space-between; }
img { width: 420px; height: auto; display: block; }
h1 { margin: 0; font-family: "Bricolage Grotesque", sans-serif; font-weight: 800; font-size: 64px; line-height: 0.95; letter-spacing: -0.02em; text-transform: uppercase; }
p { margin: 0; font-family: "Anek Latin", sans-serif; font-size: 24px; color: #45654E; }
</style><main><img src="${pub("brand/lockup-day.png")}" alt=""><h1>One hot thali.<br>Cooked today.<br>Paid at the door.</h1><p>Home kitchens · your pin code · cash at the door</p></main>`;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const file = join(mkdtempSync(join(tmpdir(), "gs-fg-")), "fg.html");   // a file page, because a page made by setContent may not open file:// fonts and images
writeFileSync(file, html);
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await b.close();
