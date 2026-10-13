// Web app manifest for the installable PWA. Colours come from design/tokens.json (the source of truth).
import tokens from "../../design/tokens.json";

export const manifest = {
  name: "GoServe",
  short_name: "GoServe",
  description: "Fresh food at your door in under 15 minutes.",
  start_url: "/",
  display: "standalone" as const,
  theme_color: tokens.color.core.deepGreen,
  background_color: tokens.color.core.cream,
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
};
