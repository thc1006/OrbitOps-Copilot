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
  Viewer: ({
    children,
    baseLayer,
  }: {
    children?: ReactNode;
    /** ADR-011 contract: SatelliteView MUST pass `baseLayer` to override
     * the default Ion-backed Bing imagery. Mock exposes its presence
     * through a data-attr so the test can assert the prop arrives at
     * the boundary. Catches future regressions where the prop is
     * removed and Ion silently re-engages. */
    baseLayer?: unknown;
  }) => {
    const baseLayerKind =
      baseLayer && typeof baseLayer === "object" && "__mock" in baseLayer
        ? String((baseLayer as { __mock: unknown }).__mock)
        : baseLayer === undefined
          ? "(default-ion-backed)"
          : "(custom)";
    return (
      <div
        data-testid="cesium-viewer"
        data-resium="viewer"
        data-has-base-layer={baseLayer !== undefined ? "true" : "false"}
        data-base-layer-kind={baseLayerKind}
      >
        {children}
      </div>
    );
  },
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
  // VS-13 camera-flyto fix (2026-05-05): SatelliteView mounts a
  // <CameraFlyTo destination={...} once={true}> to fly the camera to
  // NYCU on first render — without this, the default Cesium camera
  // sits over the Atlantic and the user sees no entities (they are
  // all on the far side of the globe).
  CameraFlyTo: () => <div data-resium="camera-fly-to" />,
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
  // VS-13 fix (2026-05-05): SatelliteView passes
  // `baseLayer={ImageryLayer.fromProviderAsync(TileMapServiceImageryProvider.fromUrl(...))}`
  // to bypass Cesium's default Ion-backed Bing imagery (offline
  // NaturalEarthII texture). Mock both factories so the cesium import
  // doesn't throw "X is not a function" at component mount.
  ImageryLayer: {
    fromProviderAsync: (providerPromise: unknown, options?: unknown) => ({
      __mock: "ImageryLayer.fromProviderAsync",
      providerPromise,
      options,
    }),
  },
  TileMapServiceImageryProvider: {
    fromUrl: (url: string) =>
      Promise.resolve({
        __mock: "TileMapServiceImageryProvider",
        url,
      }),
  },
});
