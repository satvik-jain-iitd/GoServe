// Builds the five role icons of the GoServe apps (customer, kitchen, rider, ops, admin) from one template, so they read as one family.
// Same pin, same white badge, same grid and stroke; only the glyph and the ring colour change. Colours come from design/tokens.json.
// Run: node design/brand/icons/build.mjs   (it borrows Playwright from the app folder)
// Writes design/brand/icons/<role>.svg, <role>-maskable.svg and app/public/icons/<role>-192.png, <role>-512.png, <role>-maskable-512.png.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, "../../../app/package.json"))("@playwright/test");   // the app folder has Playwright
const tokens = JSON.parse(readFileSync(join(here, "../../tokens.json"), "utf8")).color;
const c = { ...tokens.core, ...tokens.supporting, paper: tokens.paper };
const PUBLIC = join(here, "../../../app/public/icons");

// Glyphs are drawn around (0,0) inside a 120 x 120 box, white, round joins: the same weight (stroke 9) everywhere.
const W = c.paper;
const glyph = {
  customer: `<g fill="${W}"><path d="M-34 -14h68l-6 52a8 8 0 0 1-8 7h-40a8 8 0 0 1-8-7z"/></g>
    <path d="M-17 -16v-6a17 17 0 0 1 34 0v6" fill="none" stroke="${W}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="-8" cy="6" r="4.5" fill="${c.deepGreen}"/><circle cx="8" cy="6" r="4.5" fill="${c.deepGreen}"/>`,
  kitchen: `<g fill="${W}"><circle cx="-24" cy="-12" r="19"/><circle cx="0" cy="-24" r="23"/><circle cx="24" cy="-12" r="19"/>
    <rect x="-34" y="-12" width="68" height="34" rx="6"/><rect x="-34" y="30" width="68" height="14" rx="5"/></g>`,
  rider: `<g fill="none" stroke="${W}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><circle cx="-26" cy="32" r="14"/><circle cx="32" cy="32" r="14"/>
    <path d="M-26 32h22l12-30"/><path d="M20 32l10-46h-14"/></g>
    <rect x="-46" y="-18" width="36" height="32" rx="6" fill="${W}"/>`,
  ops: `<g fill="${W}"><rect x="-40" y="2" width="22" height="42" rx="5"/><rect x="-11" y="-22" width="22" height="66" rx="5"/><rect x="18" y="-8" width="22" height="52" rx="5"/></g>`,
  admin: `<g fill="none" stroke="${W}" stroke-width="9" stroke-linecap="round"><path d="M-40 -22h80M-40 4h80M-40 30h80"/></g>
    <g fill="${W}"><circle cx="-14" cy="-22" r="11"/><circle cx="16" cy="4" r="11"/><circle cx="-8" cy="30" r="11"/></g>`,
};
const ring = { customer: c.lime, kitchen: c.warmYellow, rider: c.earthLight, ops: c.sage, admin: c.olive };

// The pin of the GoServe mark: a round head and a point. Centre of the head: (256, 200). `k` scales it for the maskable version.
const svg = (role, { maskable = false } = {}) => {
  const k = maskable ? 0.8 : 1.12;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${c.cream}"/>
  <g transform="translate(256 256) scale(${k}) translate(-256 -256)">
    <path d="M256 54c-77 0-140 63-140 140 0 84 90 176 140 262 50-86 140-178 140-262 0-77-63-140-140-140z" fill="${c.deepGreen}"/>
    <circle cx="256" cy="194" r="96" fill="none" stroke="${ring[role]}" stroke-width="17"/>
    <g transform="translate(256 194) scale(1.04)">${glyph[role]}</g>
  </g>
</svg>`;
};

mkdirSync(PUBLIC, { recursive: true });
const browser = await chromium.launch();
for (const role of Object.keys(glyph)) {
  for (const [suffix, opts] of [["", {}], ["-maskable", { maskable: true }]]) {
    const source = svg(role, opts);
    writeFileSync(join(here, `${role}${suffix}.svg`), source);
    for (const size of suffix ? [512] : [192, 512]) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(`<body style="margin:0">${source.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
      await page.screenshot({ path: join(PUBLIC, `${role}${suffix}-${size}.png`) });
      await page.close();
    }
  }
}
await browser.close();
console.log("icons written for", Object.keys(glyph).join(", "));
