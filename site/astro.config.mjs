// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// The site is a fully static doorway. Output is plain HTML/CSS with almost no JS.
// `site` is used for canonical URLs and the sitemap.
export default defineConfig({
  site: "https://letsdwelo.in",
  output: "static",
  integrations: [sitemap()],
  build: {
    // Keep asset filenames readable in the Cloudflare Pages deploy log.
    assets: "assets",
  },
});
