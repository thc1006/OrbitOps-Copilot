import "@testing-library/jest-dom";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./i18n/locales/en.json";
import zhTW from "./i18n/locales/zh-TW.json";

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

// T1 (i18n): bootstrap i18next synchronously at test setup so
// `useTranslation()` inside components renders English strings instead
// of bare keys. Locked to "en" deterministically — UI-locale tests
// that need a different language can override per-test by calling
// `i18next.changeLanguage(...)`.
//
// We intentionally do NOT call the production `initI18n()` helper
// here because it picks the locale from `navigator.language`, which
// jsdom resolves to "en-US" today but could surprise future test
// environments. Inline init keeps tests deterministic.
if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      "zh-TW": { translation: zhTW },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    // Synchronous resource bundles → init resolves immediately;
    // `t()` is callable from this point forward.
  });
}
