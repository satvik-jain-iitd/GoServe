import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./App";
import { HealthScreen } from "./screens/HealthScreen";
import { roleFromPath, roleTitle } from "./lib/roles";

// The address picks the app (story #83). Each role page is a static file with its own manifest link and title (see vite.config.ts), so the install
// uses the right start address. The title is set here too, for the dev server where those static pages do not exist.
const path = window.location.pathname;
const role = roleFromPath(path);
if (role) document.title = roleTitle(role);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {path.replace(/\/$/, "") === "/health" ? <HealthScreen /> : <App lock={role ?? undefined} />}
  </StrictMode>,
);
