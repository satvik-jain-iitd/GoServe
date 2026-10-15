import { defineConfig, devices } from "@playwright/test";

// Story #56 S1: the demo path against the real dev app, 20 times. It writes real rows to goserve-dev (one anonymous user per run).
// Run: npm run test:live   (LIVE_URL changes the address; prod only after the owner's yes)
export default defineConfig({
  testDir: "./tests/live",
  repeatEach: 20,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"], ["json", { outputFile: "test-results/live-runs.json" }]],
  use: { baseURL: process.env.LIVE_URL ?? "https://goserve-app-dev.vercel.app" },
  projects: [{ name: "pixel7", use: { ...devices["Pixel 7"] } }],
});
