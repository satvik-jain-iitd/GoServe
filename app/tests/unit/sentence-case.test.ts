// Story #1044 (owner, 8 Nov 2026): sentence case everywhere. Only the first word and proper nouns get a capital; nothing is made uppercase by style.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC = resolve(__dirname, "../../src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(n) ? [p] : []; });
const hits = (re: RegExp) => files(SRC).filter((f) => re.test(readFileSync(f, "utf8"))).map((f) => f.replace(SRC, "src"));

describe("sentence case", () => {
  it("no text is made uppercase by style", () => {
    expect(hits(/text-transform:\s*uppercase/i)).toEqual([]);
    expect(hits(/textTransform:\s*["']uppercase["']/)).toEqual([]);
  });
  it("standalone words keep a capital first letter: Or and Veg", () => {
    expect(hits(/<span>or<\/span>/)).toEqual([]);
    expect(hits(/<span className="mono">VEG<\/span>/)).toEqual([]);
  });
});
