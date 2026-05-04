// VS-13 S1.1 (2026-05-04): TypeScript 6 introduced stricter module
// resolution that rejects side-effect-only imports without type
// declarations (was lenient under TS 5.x). The CSS / @fontsource
// imports in main.tsx are pure runtime side-effects (Vite handles
// bundling), so we declare them as ambient `unknown` modules.
//
// Errors silenced by this file (TS2882):
//   - import "@fontsource/roboto/300.css"
//   - import "@fontsource-variable/jetbrains-mono"
//   - any future `*.css` side-effect imports

declare module "*.css";
declare module "@fontsource/*";
declare module "@fontsource-variable/*";
