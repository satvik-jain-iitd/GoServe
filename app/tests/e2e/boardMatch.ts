// Story #1168: the board-match harness. Each approved board has its measured anchors (board-geometry.json: tag, class, text, box, font, colour, background, at 390 x 844 in Day).
// The app is measured the same way, then each board anchor is matched to an app element by tag and text and compared: text and role, box (4 px), order, font, colour, background.
// Anchors the board has that the app lacks, and buttons the app has that the board lacks, are failures. One small HTML writer shows the board and the app side by side.
import type { Page } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export type Anchor = { tag: string; cls: string; text: string; box: [number, number, number, number]; font: string; color: string; bg: string };
export type Failure = { anchor: string; check: string; expected: string; seen: string; board?: Anchor["box"]; app?: Anchor["box"] };
export type Verdict = { board: string; ok: boolean; boards: number; matched: number; failures: Failure[]; anchors: Anchor[]; appAnchors: Anchor[]; note?: string };

export const TOLERANCE = 4;
const here = import.meta.dirname;
export const geometry: Record<string, Anchor[]> = JSON.parse(readFileSync(resolve(here, "boards/board-geometry.json"), "utf8"));

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const bare = (s: string) => norm(s).replace(/\s*[›»]$/, "");
// The same words: equal, or one is the start of the other (a row's second line is sample data: "Saved addresses" and "Saved addresses Home, Work, and 1 more ›").
const same = (a: string, b: string) => { const [x, y] = [bare(a), bare(b)]; return x === y || (Math.min(x.length, y.length) >= 6 && (x.startsWith(y) || y.startsWith(x))); };

/** Every visible element a board could name, measured like the board's own anchors: tag, class, text (own words, label, alt or placeholder), box, font, colour, background. */
export async function measure(page: Page): Promise<Anchor[]> {
  return page.evaluate(() => {
    const out: { tag: string; cls: string; text: string; box: [number, number, number, number]; font: string; color: string; bg: string }[] = [];
    const words = (el: Element) => {
      const t = ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim();
      return t || el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("placeholder") || el.getAttribute("title") || "";
    };
    for (const el of Array.from(document.querySelectorAll("h1,h2,h3,button,a[href],input,textarea,select,img,.ui-slip,.ui-closed"))) {
      if (el.closest(".leaflet-control-container")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none") continue;
      out.push({ tag: el.tagName.toLowerCase(), cls: (el.getAttribute("class") ?? "").trim(), text: words(el), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], font: s.fontSize, color: s.color, bg: s.backgroundColor });
    }
    return out;
  });
}

const hasSlip = (cls: string) => cls.split(/\s+/).includes("ui-slip");   // the class itself, not ui-slip-title
const family = (tag: string, cls = "") => (hasSlip(cls) ? "slip" : tag === "a" || tag === "button" ? "press" : tag === "input" || tag === "textarea" || tag === "select" ? "field" : tag);
const isSlip = (a: Anchor) => hasSlip(a.cls);
const label = (a: Anchor) => `${a.tag}${a.text ? ` "${norm(a.text).slice(0, 40)}"` : a.cls ? `.${a.cls.split(" ")[0]}` : ""}`;

/** Compare one board with the measured app. `alias` maps a board text to the words the sample data gives in the app (a dish, a price, an address). */
export function compare(board: string, app: Anchor[], alias: Record<string, string | string[]> = {}): Verdict {
  const want = (geometry[board] ?? []).filter((a) => isSlip(a) || norm(a.text) !== "");
  const failures: Failure[] = [];
  const used = new Set<number>();
  const pairs: { b: Anchor; a: Anchor }[] = [];
  for (const b of want) {
    const texts = [norm(b.text), ...[alias[norm(b.text)] ?? []].flat().map(norm)];
    let best = -1, bestDy = Infinity;
    app.forEach((a, i) => {
      if (used.has(i) || family(a.tag, a.cls) !== family(b.tag, b.cls)) return;
      const ok = isSlip(b) ? isSlip(a) : texts.some((t) => same(a.text, t));
      const dy = Math.abs(a.box[1] - b.box[1]);
      if (ok && dy < bestDy) { best = i; bestDy = dy; }
    });
    if (best < 0) { failures.push({ anchor: label(b), check: "missing", expected: "an element with this text and role", seen: "none", board: b.box }); continue; }
    used.add(best);
    const a = app[best];
    pairs.push({ b, a });
    const add = (check: string, expected: string, seen: string) => failures.push({ anchor: label(b), check, expected, seen, board: b.box, app: a.box });
    const [bx, by, bw, bh] = b.box, [ax, ay, aw, ah] = a.box;
    if (Math.abs(ay - by) > TOLERANCE) add("y", String(by), String(ay));
    if (Math.abs(ah - bh) > TOLERANCE) add("height", String(bh), String(ah));
    if (Math.abs(ax - bx) > TOLERANCE) add("x", String(bx), String(ax));
    if (Math.abs(aw - bw) > TOLERANCE) add("width", String(bw), String(aw));
    const words = !isSlip(b) && b.tag !== "img";   // a picture or a slip has no font or text colour to compare
    if (words && a.font !== b.font) add("font size", b.font, a.font);
    if (words && a.color !== b.color) add("colour", b.color, a.color);
    if (a.bg !== b.bg) add("background", b.bg, a.bg);
  }
  // Order, top to bottom: the app's matched anchors follow the board's order (within the tolerance).
  const byBoard = [...pairs].sort((p, q) => p.b.box[1] - q.b.box[1] || p.b.box[0] - q.b.box[0]);
  for (let i = 1; i < byBoard.length; i++) {
    if (byBoard[i].a.box[1] + TOLERANCE < byBoard[i - 1].a.box[1]) failures.push({ anchor: label(byBoard[i].b), check: "order", expected: `below ${label(byBoard[i - 1].b)}`, seen: "above it", board: byBoard[i].b.box, app: byBoard[i].a.box });
  }
  // Buttons and links the app shows on screen that the board does not have.
  app.forEach((a, i) => {
    if (used.has(i) || family(a.tag, a.cls) !== "press" || norm(a.text) === "" || a.box[1] >= 844) return;
    if (want.some((b) => family(b.tag, b.cls) === "press" && same(b.text, a.text))) return;
    failures.push({ anchor: label(a), check: "extra", expected: "not on the board", seen: "a button on the screen", app: a.box });
  });
  return { board, ok: failures.length === 0, boards: want.length, matched: pairs.length, failures, anchors: geometry[board] ?? [], appAnchors: app };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const rect = (b: number[], css: string, text = "") => `<i style="${css};left:${b[0]}px;top:${b[1]}px;width:${b[2]}px;height:${b[3]}px;font:10px system-ui;color:#445;overflow:hidden">${esc(text.slice(0, 40))}</i>`;

/** The report: one section per screen, the board (its picture if we have it, else its anchors drawn as boxes) and the app side by side; the failing anchors outlined in red, and listed. */
export function writeReport(dir: string): string {
  mkdirSync(dir, { recursive: true });
  mkdirSync(resolve(dir, "boards"), { recursive: true });
  for (const f of readdirSync(resolve(here, "boards")).filter((n) => n.endsWith(".png"))) copyFileSync(resolve(here, "boards", f), resolve(dir, "boards", f));
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const verdicts: Verdict[] = files.map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")));
  const sections = verdicts.map((v) => {
    const pic = existsSync(resolve(here, `boards/${v.board}.png`)) ? `<img src="boards/${v.board}.png" width="390">` : "";
    const drawn = v.anchors.filter((a) => a.box[2] > 0).map((a) => rect(a.box, "position:absolute;border:1px solid #9aa89c;background:rgba(150,168,152,.12)", a.text)).join("");
    const red = (side: "board" | "app") => v.failures.filter((f) => f[side]).map((f) => rect(f[side]!, "position:absolute;outline:2px solid #d11;background:rgba(209,17,17,.12)")).join("");
    const rows = v.failures.map((f) => `<tr><td>${esc(f.anchor)}</td><td>${f.check}</td><td>${esc(f.expected)}</td><td>${esc(f.seen)}</td></tr>`).join("");
    return `<section><h2>${v.ok ? "PASS" : "FAIL"} · ${esc(v.board)} <small>${v.matched} of ${v.boards} anchors matched, ${v.failures.length} mismatches${v.note ? " · " + esc(v.note) : ""}</small></h2>
<div class="pair"><div class="pane"><p>Board</p><div class="shot" style="width:390px;height:844px">${pic || drawn}${red("board")}</div></div>
<div class="pane"><p>App</p><div class="shot" style="width:390px;height:844px"><img src="${v.board}.png" width="390">${red("app")}</div></div></div>
${rows ? `<table><tr><th>Anchor</th><th>Check</th><th>Board</th><th>App</th></tr>${rows}</table>` : ""}</section>`;
  }).join("\n");
  const pass = verdicts.filter((v) => v.ok).length;
  const html = `<!doctype html><meta charset="utf-8"><title>Board match</title><style>body{font:14px system-ui;margin:20px;background:#f4f4ee;color:#263528}.pair{display:flex;gap:24px;flex-wrap:wrap}.shot{position:relative;background:#fff;border:1px solid #bbb;overflow:hidden}.shot img{display:block}.shot i{position:absolute;display:block}table{border-collapse:collapse;margin:12px 0 40px}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}h2 small{font-weight:400;color:#555}</style>
<h1>Board match: ${pass} of ${verdicts.length} screens pass</h1><p>Each screen: the approved board on the left, the app on the right, mismatches outlined in red.</p>
${sections}`;
  writeFileSync(resolve(dir, "index.html"), html);
  return resolve(dir, "index.html");
}
