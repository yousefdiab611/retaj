import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { preloadBrandLogo } from "./lib/branding";
import { initSentry } from "./lib/sentry";
import "./index.css";

function applyInitialTheme() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem("retaj_theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
}

void initSentry();
preloadBrandLogo();
applyInitialTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
