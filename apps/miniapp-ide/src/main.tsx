import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { api } from "./lib/api";
import { configureMonaco } from "./lib/monaco";
import "./styles.css";

// Monaco must know its workers and SDK typings before the first editor mounts.
configureMonaco();

// `index.html` already applies the persisted theme before the first paint, but
// the frame of a decoration-less window is painted by the OS from the window's
// own theme, which starts at the "Dark" value in `tauri.conf.json`. Switch it as
// soon as the API is available so a light UI does not keep a black border.
if (api.isDesktop()) {
  const bootTheme =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  void getCurrentWindow().setTheme(bootTheme).catch(() => undefined);
}

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root is missing");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
