import "@testing-library/jest-dom";

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
