// Story #1155 (owner, QA screen 12, 9 Nov 2026): prod opens Google-first, same as dev. The phone code login is paused: only the admin switch otp_login_on turns it on.
// So no workflow may build the app with VITE_OTP_GATE: "1", or a settings read that fails would fall back to the number screen.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("../../../.github/workflows/", import.meta.url);

describe("workflows never set the phone code gate", () => {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".yml"))) {
    it(`${f} has no VITE_OTP_GATE set to 1`, () => {
      expect(readFileSync(new URL(f, dir), "utf8")).not.toMatch(/^\s*VITE_OTP_GATE:\s*["']?1/m);
    });
  }
});
