import { defineConfig, devices } from "@playwright/test";

// Story #324 (M.5): the demo rehearsal, twice, one run after the other (two runs in one sitting would share one demo kitchen).
// LIVE_URL has no default on purpose: the test places a real order. Prod only after the owner's yes.
export default defineConfig({
  testDir: "./tests/live",
  testMatch: /demo-rehearsal\.live\.spec\.ts/,
  repeatEach: 2,
  workers: 1,
  timeout: 25 * 60_000,
  reporter: [["list"]],
  use: { baseURL: process.env.LIVE_URL },
  projects: [{ name: "pixel7", use: { ...devices["Pixel 7"] } }],
});
