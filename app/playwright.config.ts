import { defineConfig, devices } from "@playwright/test";

// E2E runs against the production build served by `vite preview`: the real artifact, service worker included.
// It has its own port (4180) so a preview you started by hand with real keys is never reused by mistake.
export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: "http://localhost:4180" },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Test keys are baked into the build; the specs answer those hosts themselves.
    command:
      "VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=anon-test VITE_ORDER_URL=https://orders.test/gs-order VITE_VAPID_PUBLIC_KEY=AQID VITE_STYLEGUIDE=1 VITE_DEMO_TOKEN=demo-token VITE_SIM_URL=https://sim.test/gs-sim VITE_SIM_TOKEN=sim-token VITE_ENGINE_URL=https://engine.test/gs-engine VITE_AUTOPILOT_MS=300 VITE_REASK_MS=400 npm run build && npm run preview -- --port 4180 --strictPort",
    url: "http://localhost:4180",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
