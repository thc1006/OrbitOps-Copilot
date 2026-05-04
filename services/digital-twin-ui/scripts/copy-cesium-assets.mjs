#!/usr/bin/env node
/**
 * VS-13 S2 (2026-05-04): copy CesiumJS static runtime assets into
 * public/cesium/ so Vite serves them at /cesium/Workers, /cesium/Assets,
 * /cesium/Widgets, /cesium/ThirdParty — matching the
 * `CESIUM_BASE_URL=/cesium` define in vite.config.ts.
 *
 * Why a manual script (vs vite-plugin-static-copy):
 *   v4 of the plugin preserves the full source path under the destination
 *   when the src includes `node_modules/...`. Tried `*`, `**`/`*`, and
 *   wholesale-directory targeting; all landed at
 *   dist/cesium/node_modules/cesium/Build/Cesium/..., not dist/cesium/...
 *   Node's `cpSync` is dependency-free and gives exact control.
 *
 * Hooked from package.json: `predev`, `prebuild`, `pretest` so the
 * copy happens before Vite (or vitest) starts. Idempotent — wipes
 * + recopies on every run so a node_modules upgrade picks up new
 * Worker scripts immediately.
 *
 * `public/cesium/` is gitignored — see .gitignore. Don't commit ~3 MB
 * of derived assets.
 */
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const src = join(repoRoot, "node_modules", "cesium", "Build", "Cesium");
const dest = join(repoRoot, "public", "cesium");

if (!existsSync(src)) {
  console.error(
    `[copy-cesium-assets] source not found: ${src}\n` +
      "Run `npm install` first; cesium ^1.141.0 is in dependencies.",
  );
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true });
}
mkdirSync(dest, { recursive: true });

cpSync(src, dest, { recursive: true });

console.log(`[copy-cesium-assets] copied ${src} → ${dest}`);
