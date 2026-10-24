import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` keeps asset URLs relative so the package works on the random
// 127.0.0.1:<port> origin the QChat runtime creates for each Mini App.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
});
