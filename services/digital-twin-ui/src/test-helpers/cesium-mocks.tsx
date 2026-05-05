/**
 * Shared resium + cesium mock factory for vitest tests that mount any
 * subtree containing <SatelliteView />. Real CesiumJS pulls in WebGL,
 * Workers, and terrain assets which jsdom cannot load — see the
 * Resium + Jest community thread (community.cesium.com/t/jest-testing-with-resium/25755).
 *
 * Usage:
 *   import { vi } from "vitest";
 *   import { mockResium, mockCesium } from "../test-helpers/cesium-mocks";
 *   vi.mock("resium", mockResium);
 *   vi.mock("cesium", mockCesium);
 *
 * The factories MUST be passed as functions (vi.mock hoists module
 * factories before imports; passing the value directly causes "cannot
 * access X before initialization").
 */
import type { ReactNode } from "react";

export const mockResium = () => ({
  Viewer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="cesium-viewer" data-resium="viewer">
      {children}
    </div>
  ),
  Entity: ({
    children,
    name,
    ...rest
  }: {
    children?: ReactNode;
    name?: string;
    position?: unknown;
    [key: `data-${string}`]: unknown;
  }) => {
    // Forward `data-*` props through the mock so SatelliteView's test-
    // only `data-pass-fraction` attribute is observable. Filter to
    // data-* keys only — passing position/description through would
    // clobber the testid surface above.
    const dataAttrs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (k.startsWith("data-")) dataAttrs[k] = v;
    }
    return (
      <div
        data-testid={`cesium-entity-${name?.replace(/\s+/g, "-") ?? "anon"}`}
        data-resium="entity"
        data-name={name}
        {...dataAttrs}
      >
        {children}
      </div>
    );
  },
  PointGraphics: () => <div data-resium="point-graphics" />,
  LabelGraphics: () => <div data-resium="label-graphics" />,
  PolylineGraphics: () => <div data-resium="polyline-graphics" />,
  CylinderGraphics: () => <div data-resium="cylinder-graphics" />,
});

export const mockCesium = () => ({
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
    fromCssColorString: (css: string) => ({
      css,
      withAlpha: (alpha: number) => ({ css, alpha }),
    }),
    RED: { name: "RED" },
    YELLOW: { name: "YELLOW" },
    LIME: { name: "LIME" },
  },
  Ion: { defaultAccessToken: "" },
});
