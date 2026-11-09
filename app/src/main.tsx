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
import { dropOldJoin } from "./lib/session";
import { claimDevice } from "./lib/deviceOwner";
import { getClient } from "./lib/supabase";
import { lockZoom } from "./lib/zoomLock";
import { watchForUpdates } from "./lib/updates";
import { initAnalytics, reportUncaught } from "./lib/analytics";

// The address picks the app (story #83). Each role page is a static file with its own manifest link and title (see vite.config.ts), so the install
// uses the right start address. The title is set here too, for the dev server where those static pages do not exist.
let store: Storage | null = null;
try { store = window.localStorage; } catch { /* storage blocked: the clock decides */ }
watchForUpdates(navigator.serviceWorker, document, () => window.location.reload());   // an open installed app gets the new build (#320)
lockZoom(document);   // story #932: no pinch zoom, the tabs stay put
applyTheme(store, document);   // Day or Night; index.html already did it for the first paint
dropOldJoin();   // story #938: a key an older version saved is removed before anything reads a session
claimDevice();   // story 1115 (and 1139, below, for a sign-in with no reload): a different account on this phone never opens with the previous one's address (before anything reads the area, the draft or the alerts choice)
if (typeof window !== "undefined" && roleFromPath(window.location.pathname) === "customer") {   // story #1139: a sign-in as another account in this same tab (the phone-code path) takes the phone too; the screens hold the old state, so the page starts again
  try { getClient().auth.onAuthStateChange((event) => { if (event === "SIGNED_IN" && claimDevice(window.localStorage, true)) window.location.reload(); }); } catch { /* no client (a page without the backend): nothing to watch */ }
}
const path = window.location.pathname;
const role = roleFromPath(path);
if (role) document.title = roleTitle(role);
if (role === "customer") void initAnalytics(import.meta.env);   // story #207: only when VITE_POSTHOG_KEY is set (dev builds)

// Story #740: an error React cannot recover from also reaches PostHog error tracking (dev builds); the console line stays.
createRoot(document.getElementById("root")!, { onUncaughtError: reportUncaught }).render(
  <StrictMode>
    {path.replace(/\/$/, "") === "/health" ? <HealthScreen /> : styleguideOn(path, import.meta.env.VITE_STYLEGUIDE) ? <Styleguide /> : <App lock={role ?? undefined} />}
  </StrictMode>,
);
