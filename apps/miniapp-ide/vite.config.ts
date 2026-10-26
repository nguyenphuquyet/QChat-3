import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    // Tauri ships modern engines (WebView2 / WKWebView / WebKitGTK); Monaco's
    // language workers contain syntax that must not be down-levelled.
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome110" : "safari16",
    minify: process.env.TAURI_ENV_DEBUG ? false : true,
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    chunkSizeWarningLimit: 4096,
  },
});
