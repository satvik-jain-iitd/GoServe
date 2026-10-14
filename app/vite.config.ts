import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { manifest, roleManifest } from "./src/pwa-manifest.ts";
import { ROLE_APPS } from "./src/lib/roles.ts";

// One manifest file per role app (story #83); each app page points to its own.
const roleManifests = (): Plugin => ({
  name: "role-manifests",
  generateBundle() {
    for (const role of ROLE_APPS) this.emitFile({ type: "asset", fileName: `manifests/${role}.webmanifest`, source: JSON.stringify(roleManifest(role)) });
  },
});

export default defineConfig({
  plugins: [react(), roleManifests(), VitePWA({ registerType: "autoUpdate", manifest, includeAssets: ["icons/*"] })],
});
