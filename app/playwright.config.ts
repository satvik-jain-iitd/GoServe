import { defineConfig, devices } from "@playwright/test";

// E2E runs against the production build served by `vite preview`: the real artifact, service worker included.
export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: "http://localhost:4173" },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Test keys are baked into the build; the specs answer those hosts themselves.
    command:
      "VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=anon-test VITE_ORDER_URL=https://orders.test/gs-order VITE_DEMO_TOKEN=demo-token npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
