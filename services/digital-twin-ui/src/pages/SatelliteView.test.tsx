/**
 * VS-13 S2 — SatelliteView page contract test (closes SPEC-004 §AC-S004-3).
 *
 * Asserts the CesiumJS satellite-pass viewer is mounted under
 * `/satellite-view` and exposes the contract surfaces that S3
 * (pass animation) and S4 (beam coverage cones) build on:
 *
 *   1. The page renders a Cesium viewer container (mocked resium
 *      `<Viewer>` so jsdom doesn't try to load 3 MB of WebGL runtime)
 *   2. A ground-station Entity is present at NYCU's lat/lon (24.787, 120.998)
 *   3. CESIUM_BASE_URL is reachable as a global at runtime (set via
 *      vite.config.ts `define:`); tests assert the constant exists
 *      so a vite config regression that drops the define is caught
 *      before it breaks production
 *
 * Mock strategy: `resium` + `cesium` are 100% mocked. The real modules
 * are too heavy for jsdom (cesium pulls in WebGL, terrain assets, and
 * worker scripts). We assert the React tree shape only.
 */
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock resium FIRST (before SatelliteView import) so the dynamic
// imports inside the page resolve to our stubs. resium re-exports
// React-friendly wrappers around cesium primitives.
vi.mock("resium", () => ({
  Viewer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="cesium-viewer" data-resium="viewer">
      {children}
    </div>
  ),
  Entity: ({
    children,
    name,
  }: {
    children?: React.ReactNode;
    name?: string;
    position?: unknown;
  }) => (
    <div
      data-testid={`cesium-entity-${name?.replace(/\s+/g, "-") ?? "anon"}`}
      data-resium="entity"
      data-name={name}
    >
      {children}
    </div>
  ),
  PointGraphics: () => <div data-resium="point-graphics" />,
  LabelGraphics: () => <div data-resium="label-graphics" />,
  // VS-13 S3: SatelliteView now renders a PolylineGraphics for the
  // pass trace. Mock returns a discriminable element so tests can
  // assert the polyline exists in the rendered tree.
  PolylineGraphics: () => <div data-resium="polyline-graphics" />,
}));

// Mock cesium primitives — only the surfaces SatelliteView calls.
vi.mock("cesium", () => ({
  // VS-13 S3 (PR #77 review #4 fix): pixelOffset is screen-space —
  // Cartesian2(x, y) in pixels, NOT Cartesian3.fromDegrees(lon, lat).
  // Test mock returns a discriminable struct so the component's Label
  // pixelOffset can be verified by shape if a future test asserts it.
  Cartesian2: class {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
  Cartesian3: {
    fromDegrees: (lon: number, lat: number, height = 0) => ({
      lon,
      lat,
      height,
    }),
  },
  Color: {
    fromCssColorString: (css: string) => ({ css }),
    RED: { name: "RED" },
    YELLOW: { name: "YELLOW" },
    LIME: { name: "LIME" },
  },
  Ion: { defaultAccessToken: "" },
}));

import SatelliteView from "./SatelliteView";

describe("SatelliteView (VS-13 S2 — CesiumJS skeleton)", () => {
  test("renders a Cesium viewer container", () => {
    render(<SatelliteView />);
    expect(screen.getByTestId("cesium-viewer")).toBeInTheDocument();
  });

  test("renders an NYCU ground-station entity", () => {
    render(<SatelliteView />);
    // Ground station name is the contract surface S3 (pass animation)
    // will use to anchor the orbit polyline and S4 (beam cones) will
    // use to anchor coverage ellipsoids. If this entity disappears
    // those features break silently.
    expect(
      screen.getByTestId("cesium-entity-NYCU-Ground-Station"),
    ).toBeInTheDocument();
  });

  test("has CESIUM_BASE_URL globally defined at runtime", () => {
    // vite.config.ts injects this via `define:` so cesium can resolve
    // its Workers / Assets / Widgets at runtime. If it's missing, the
    // browser hits 404s on cesium worker scripts and the viewer
    // silently fails to render terrain. Test guards the vite config.
    const w = globalThis as unknown as { CESIUM_BASE_URL?: string };
    expect(typeof w.CESIUM_BASE_URL).toBe("string");
    expect(w.CESIUM_BASE_URL).toMatch(/^\/cesium/);
  });
});
