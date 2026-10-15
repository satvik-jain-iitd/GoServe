import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./App";
import { HealthScreen } from "./screens/HealthScreen";
import { roleFromPath } from "./lib/roles";

// The address picks the app (story #83). A role app points to its own manifest and title, so each can be installed on its own.
const path = window.location.pathname;
const role = roleFromPath(path);
if (role) {
  document.querySelector("link[rel=manifest]")?.remove();
  const link = Object.assign(document.createElement("link"), { rel: "manifest", href: `/manifests/${role}.webmanifest` });
  document.head.appendChild(link);
  document.title = role === "customer" ? "GoServe" : `GoServe ${role[0].toUpperCase()}${role.slice(1)}`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {path.replace(/\/$/, "") === "/health" ? <HealthScreen /> : <App lock={role ?? undefined} />}
  </StrictMode>,
);
