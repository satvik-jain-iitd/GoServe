// Web app manifest for the installable PWA. Colours come from design/tokens.json (deep green, cream).
export const manifest = {
  name: "GoServe",
  short_name: "GoServe",
  description: "Fresh food at your door in under 15 minutes.",
  start_url: "/",
  display: "standalone" as const,
  theme_color: "#45654E",
  background_color: "#E4E6D9",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
};
