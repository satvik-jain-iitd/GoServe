import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./App";
import { HealthScreen } from "./screens/HealthScreen";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname.replace(/\/$/, "") === "/health" ? <HealthScreen /> : <App />}
  </StrictMode>,
);
