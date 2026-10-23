import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { manifest, roleManifest } from "./src/pwa-manifest.ts";
import { ROLE_APPS, roleTitle } from "./src/lib/roles.ts";
import { pushWorkerSource } from "./src/pwa-push.ts";

// One manifest file and one static HTML page per role app (story #83, install fix 22 Oct 2026).
// Chrome reads the manifest from the first HTML it gets, before any script runs. So each role page (dist/<role>/index.html) already links its own
// manifest and title; a script that swaps the link later is too late, and Add to Home Screen installed the domain instead of /customer/.
const rolePages = (): Plugin => ({
  name: "role-pages",
  enforce: "post",   // after the PWA plugin has put the default manifest link into index.html
  generateBundle(_, bundle) {
    const index = bundle["index.html"];
    if (!index || index.type !== "asset") throw new Error("role-pages: index.html is not in the bundle");
    const html = String(index.source);
    for (const role of ROLE_APPS) {
      this.emitFile({ type: "asset", fileName: `manifests/${role}.webmanifest`, source: JSON.stringify(roleManifest(role)) });
      const page = html.replace('href="/manifest.webmanifest"', `href="/manifests/${role}.webmanifest"`).replace("<title>GoServe</title>", `<title>${roleTitle(role)}</title>`)
        .replaceAll('href="/icons/icon-192.png"', `href="/icons/${role}-192.png"`);   // the tab icon and the iPhone home-screen icon
      if (page === html) throw new Error(`role-pages: could not change the manifest link for ${role}`);
      this.emitFile({ type: "asset", fileName: `${role}/index.html`, source: page });
    }
  },
});

// The push handlers (story A7) are written at build time with this project's address and public key, then loaded by the generated service worker.
const pushWorker = (): Plugin => ({
  name: "push-worker",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "push-sw.js", source: pushWorkerSource(process.env.VITE_SUPABASE_URL ?? "", process.env.VITE_SUPABASE_ANON_KEY ?? "") });
  },
});

export default defineConfig({
  plugins: [react(), rolePages(), pushWorker(), VitePWA({ registerType: "autoUpdate", manifest, includeAssets: ["icons/*"], workbox: { importScripts: ["push-sw.js"] } })],
});
