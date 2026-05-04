/// <reference types="vitest/config" />
// VS-13 S1.1 (2026-05-04): Vitest 4 + Vite 8 — `defineConfig` must come
// from `vitest/config` (not bare `vite`) so the `test:` block's typing
// is included; otherwise TS6 reports "Object literal may only specify
// known properties, and 'test' does not exist in type 'UserConfigExport'".
import { defineConfig } from "vitest/config";
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
