import "@testing-library/jest-dom";
import i18next from "i18next";

import { initI18n } from "./i18n";

// VS-9b.2: jsdom doesn't provide ResizeObserver; recharts (introduced
// by BeamSnrChart) calls it from ResponsiveContainer's useEffect.
// Without this polyfill, ANY test that mounts a Beams or App tree
// throws "ResizeObserver is not defined" — the chart-aware tests use
// a `vi.mock("recharts")` to replace ResponsiveContainer, but tests
// that render the production tree (App.test, smoke pages) still pull
// the real module.
// Match the lib.dom.d.ts ResizeObserver shape — the constructor takes
// a ResizeObserverCallback so the typeof-comparison against the global
// passes structurally.
class ResizeObserverStub {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_cb: ResizeObserverCallback) {}
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// T1 + I-14 (PR for issue #69, 2026-05-04): bootstrap i18next via the
// production `initI18n()` helper with explicit `lng: "en"` so tests
// get deterministic strings regardless of jsdom's `navigator.language`.
//
// Before this fix, test-setup reimplemented the i18next init inline
// to bypass the production helper's navigator-based detection. That
// caused a config split-brain: adding a new resource bundle, plugin,
// or interpolation option to the production helper required mirroring
// the change here too. With initI18n(lng?) accepting an override, the
// test path now reuses the production config wholesale.
if (!i18next.isInitialized) {
  void initI18n("en");
}
