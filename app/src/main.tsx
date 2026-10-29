import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./App";
import { HealthScreen } from "./screens/HealthScreen";
import { Styleguide } from "./ui/Styleguide";
import { styleguideOn } from "./ui/flag";
import { roleFromPath, roleTitle } from "./lib/roles";
import { applyTheme } from "./lib/theme";
import { watchForUpdates } from "./lib/updates";
import { initAnalytics } from "./lib/analytics";

// The address picks the app (story #83). Each role page is a static file with its own manifest link and title (see vite.config.ts), so the install
// uses the right start address. The title is set here too, for the dev server where those static pages do not exist.
let store: Storage | null = null;
try { store = window.localStorage; } catch { /* storage blocked: the clock decides */ }
watchForUpdates(navigator.serviceWorker, document, () => window.location.reload());   // an open installed app gets the new build (#320)
applyTheme(store, document);   // Day or Night; index.html already did it for the first paint
const path = window.location.pathname;
const role = roleFromPath(path);
if (role) document.title = roleTitle(role);
if (role === "customer") void initAnalytics(import.meta.env);   // story #207: only when VITE_POSTHOG_KEY is set (dev builds)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {path.replace(/\/$/, "") === "/health" ? <HealthScreen /> : styleguideOn(path, import.meta.env.VITE_STYLEGUIDE) ? <Styleguide /> : <App lock={role ?? undefined} />}
  </StrictMode>,
);
