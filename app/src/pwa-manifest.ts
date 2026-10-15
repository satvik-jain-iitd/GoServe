// Web app manifest for the installable PWA. Colours come from design/tokens.json (the source of truth).
import tokens from "../../design/tokens.json";
import type { RoleApp } from "./lib/roles";

const base = {
  name: "GoServe",
  short_name: "GoServe",
  description: "Fresh food at your door in under 15 minutes.",
  display: "standalone" as const,
  theme_color: tokens.color.core.deepGreen,
  background_color: tokens.color.core.cream,
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
};

// The demo console at the root.
export const manifest = { ...base, start_url: "/" };

// One manifest per role app (story #83): its own name, install identity (id) and scope, so each can be installed on the same phone.
const NAMES: Record<RoleApp, [string, string]> = { customer: ["GoServe", "GoServe"], kitchen: ["GoServe Kitchen", "Kitchen"], rider: ["GoServe Rider", "Rider"], ops: ["GoServe Ops", "Ops"] };
export const roleManifest = (role: RoleApp) => ({ ...base, name: NAMES[role][0], short_name: NAMES[role][1], id: `/${role}/`, scope: `/${role}/`, start_url: `/${role}/` });
