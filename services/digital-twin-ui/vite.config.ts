/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: "127.0.0.1" },
  // `hidden` emits source maps but doesn't reference them in the bundle, so
  // they're available for in-house error reporting (e.g. dev tools when a
  // contributor inspects a deployed pod) without being auto-discoverable
  // from a stranger's browser. Flip to `true` only for live debugging.
  build: { sourcemap: "hidden" },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    css: false,
  },
});
