// Sprint 0 vitest config (SPEC-004 placeholder).
// Real DOM testing harness lands in Sprint 1 (S1-06).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
