// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static output: HTML and CSS, with small React islands (motion) only where the design moves.
export default defineConfig({
  site: "https://letsdwelo.in",
  output: "static",
  integrations: [sitemap(), react()],
  vite: { plugins: [tailwindcss()] },
  build: { assets: "assets" },
});
