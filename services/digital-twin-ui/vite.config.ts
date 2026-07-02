/// <reference types="vitest/config" />
// VS-13 S1.1 (2026-05-04): Vitest 4 + Vite 8 — `defineConfig` must come
// from `vitest/config` (not bare `vite`) so the `test:` block's typing
// is included; otherwise TS6 reports "Object literal may only specify
// known properties, and 'test' does not exist in type 'UserConfigExport'".
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// VS-13 S2 (2026-05-04): CesiumJS ships its Workers / Assets / Widgets /
// ThirdParty as separate static files that must be reachable at
// `${CESIUM_BASE_URL}/...`. The `predev` / `prebuild` npm scripts run
// scripts/copy-cesium-assets.mjs which copies node_modules/cesium/Build/
// Cesium/ into public/cesium/ — Vite then serves it natively at
// /cesium/{Workers,Assets,Widgets,ThirdParty} both in dev and dist.
// (vite-plugin-static-copy v4 was tried first; its `*` glob doesn't
// recurse into subdirs and the wholesale-target form preserves the
// full source tree under dest, both unwanted. A 25-line Node script
// is more reliable.)
// `optimizeDeps.exclude: ['cesium']` keeps Vite from pre-bundling
// cesium itself (it's a 3 MB ESM blob; pre-bundling balloons dev
// rebuild times and breaks the CESIUM_BASE_URL contract because
// pre-bundled paths point inside .vite/, not /cesium/).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: "127.0.0.1" },
  // `hidden` emits source maps but doesn't reference them in the bundle, so
  // they're available for in-house error reporting (e.g. dev tools when a
  // contributor inspects a deployed pod) without being auto-discoverable
  // from a stranger's browser. Flip to `true` only for live debugging.
  build: {
    sourcemap: "hidden",
    // VS-13 S3 (2026-05-04, addresses PR #77 review #2): keep the
    // default 500 KB chunk-size warning so 500 KB–5 MB regressions
    // surface during build. The cesium chunk legitimately exceeds
    // 500 KB — that warning is expected and fires once per build for
    // the cesium chunk only (App.tsx now lazy-loads SatelliteView, so
    // the initial chunk no longer includes cesium). Don't blanket-
    // suppress with a high chunkSizeWarningLimit — that hides real
    // future regressions.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Bucket cesium + resium into a named chunk so the warning
          // (when it fires for a 5 MB chunk) is clearly attributed.
          if (id.includes("/node_modules/cesium/") || id.includes("/node_modules/resium/")) {
            return "cesium";
          }
          return undefined;
        },
      },
    },
  },
  define: {
    // Cesium reads this at runtime to resolve Workers / Assets URLs.
    // Path is rooted at the SPA's origin: `<origin>/cesium/...`.
    CESIUM_BASE_URL: JSON.stringify("/cesium"),
  },
  optimizeDeps: {
    exclude: ["cesium"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    css: false,
    // VS-19 (2026-07-02): set a valid URL so axios's isURLSameOrigin helper
    // doesn't throw "Invalid URL" when importing the module in tests.
    // jsdom defaults to `about:blank` which fails new URL("about:blank")
    // in axios v1 startup code. This is safe for all existing tests since
    // none of them assert on window.location.href.
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
  },
});
