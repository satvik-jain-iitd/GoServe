import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { manifest } from "./src/pwa-manifest.ts";

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: "autoUpdate", manifest, includeAssets: ["icons/*"] })],
});
