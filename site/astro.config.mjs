// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static output: HTML and CSS, with small React islands (motion) only where the design moves.
// Pages v1 (palette, technology, roadmap, how-it-works) were folded into the three v2 pages.
export default defineConfig({
  site: "https://letsdwelo.in",
  output: "static",
  integrations: [sitemap(), react()],
  vite: { plugins: [tailwindcss()] },
  redirects: {
    "/how-it-works": "/",
    "/technology": "/investors",
    "/roadmap": "/investors",
    "/palette": "/",
  },
  build: { assets: "assets" },
});
