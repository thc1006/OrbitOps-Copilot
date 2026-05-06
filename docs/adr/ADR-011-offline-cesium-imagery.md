# ADR-011 — Offline-first Cesium imagery (no Cesium Ion)

| 欄位 | 值 |
|---|---|
| Status | Accepted |
| Date | 2026-05-05 |
| Deciders | architect, k8s-platform-engineer |
| Supersedes | (extends ADR-002 with a runtime-imagery clause) |
| Surfaced by | PR #87 review (security-reviewer + architect dual-hat) |

## Context

CesiumJS 1.131+ defaults the `Viewer` constructor to a Bing Aerial imagery layer fetched from the **Cesium Ion CDN** with a built-in demo access token. This emits a console warning on every page load:

> Cesium ion: This application is using Cesium's default ion access token. Please assign `Cesium.Ion.defaultAccessToken` with an access token from your ion account before making any Cesium API calls.

Beyond the noise, the demo token is rate-limited and **rate-limit-exhausted requests 401**, which silently breaks imagery during a live demo. Even with `baseLayerPicker={false}` the layer is still constructed; the picker hides the UI control, not the network call.

Three failure modes informed this decision:
1. Demo machine without internet access (RunSpace booth, conference, air-gapped lab).
2. Public Wi-Fi rate-limiting Bing Maps tile fetches.
3. The Ion default token's quota being shared globally — exhausted by other CesiumJS users at unpredictable times.

This is the imagery-layer counterpart to the Cesium runtime-asset story already solved by `scripts/copy-cesium-assets.mjs`: Workers / Assets / Widgets / ThirdParty are bundled into `public/cesium/` and served by our own nginx. NaturalEarthII is included in that bundle but, until PR #87, was **not actually used by production code**.

## Decision

The OrbitOps demo path **renders satellite-pass imagery fully offline**, sourced from `public/cesium/Assets/Textures/NaturalEarthII/` (already shipped by `scripts/copy-cesium-assets.mjs`). No Cesium Ion API calls. No external imagery CDN. No environment variable for an Ion token.

Implementation contract (PR #87, `services/digital-twin-ui/src/pages/SatelliteView.tsx`):

```ts
const OFFLINE_BASE_LAYER = ImageryLayer.fromProviderAsync(
  TileMapServiceImageryProvider.fromUrl(
    "/cesium/Assets/Textures/NaturalEarthII",
  ),
  {},
);

<Viewer baseLayer={OFFLINE_BASE_LAYER} ... />
```

`Cesium.Ion.defaultAccessToken` is **deliberately not set** — leaving it at default avoids any code path attempting to validate or refresh a token. We just never make Ion calls.

## Consequences

**Positive:**
- Demo is air-gappable. Live cluster on `cloudnative-dev-telco` (kubeadm single-node, 31.41.34.19) renders identically with or without internet.
- Zero rate-limit risk on demo day. Zero signup gate for new contributors.
- Removes a future-CVE attack surface (an Ion token committed by accident would get auto-flagged by the secrets scanner; with no token at all there is nothing to leak).
- Resium + cesium imports stay minimal (mock surface in `src/test-helpers/cesium-mocks.tsx` adds only 2 factories: `ImageryLayer.fromProviderAsync` + `TileMapServiceImageryProvider.fromUrl`).

**Negative:**
- NaturalEarthII is low-resolution (4096×2048 base; 3 zoom levels). Adequate for "satellite over Taiwan from 550 km" framing; inadequate for ground-level fly-throughs.
- High-res Bing aerial / world-imagery streaming is now an **opt-in deviation** that requires a deliberate ADR reversal; future contributors cannot silently re-introduce Ion just because "it looks nicer".

**Neutral:**
- Terrain stays at the default `EllipsoidTerrainProvider` (also Ion-free); we are not using `createWorldTerrain()` which would be Ion-backed. Worth re-confirming if a future PR adds terrain features.

## Alternatives considered

1. **Cesium Ion access token via `VITE_CESIUM_ION_TOKEN` env var**
   - Pro: high-res Bing aerial; matches Cesium's "intended" path.
   - Con: signup gate, free-tier rate limit (~50 k requests/month/account), CVE surface (token leak), demo-day rate-limit risk.
   - Reject: cost > benefit at our demo scale.

2. **OpenStreetMap imagery provider** (`new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })`)
   - Pro: no Ion. Higher-res than NaturalEarthII at zoom levels.
   - Con: still requires internet on demo machine; OSM tile-usage policy explicitly disallows production demo loads.
   - Reject: only fixes the Ion warning, not the offline requirement.

3. **`baseLayer={false}` (disable imagery entirely)**
   - Pro: simplest possible config. No imagery code at all.
   - Con: globe renders as a flat-shaded ellipsoid with no continent outlines. Looks unfinished.
   - Reject: visually weak for the demo.

4. **Fly to a `EllipsoidTerrainProvider` + custom raster baked from `vector-tiles`**
   - Pro: super custom, low resource.
   - Con: order of magnitude more work for the same visual result as NaturalEarthII.
   - Reject: scope.

## Verification

- Test surface: `src/test-helpers/cesium-mocks.tsx` mocks both new factories so production imports don't throw at component mount.
- Vitest mock contract: `<Viewer baseLayer={...}>` prop forwarded through the mock and asserted in `SatelliteView.test.tsx` (PR #87 follow-up commit).
- Live demo: DevTools console clean of Ion warning on `http://31.41.34.19:30073/satellite-view`.
- Network audit (manual): browser network panel shows zero requests to `assets.cesium.com` or `dev.virtualearth.net` while `/satellite-view` is open.

## When to revisit

- If a future demo audience explicitly asks for high-res aerial (e.g. "show the actual satellite-imagery view of NYCU's rooftop"), this ADR is the gate that must be flipped via a successor ADR.
- If Cesium 2.x changes the `baseLayer` API surface, update the implementation contract above.
- If NaturalEarthII is removed from upstream Cesium (unlikely; it's been shipped since 1.0), pin a vendored copy in `services/digital-twin-ui/public/cesium-vendor/` and update `scripts/copy-cesium-assets.mjs` accordingly.

## References

- PR #87: https://github.com/thc1006/OrbitOps-Copilot/pull/87
- Resium 1.21 type def: `node_modules/resium/dist/index.d.ts:653` — `cesiumReadonlyProps_18` includes `baseLayer`, NOT the deprecated `imageryProvider`.
- Cesium ref-doc: https://cesium.com/learn/cesiumjs/ref-doc/Viewer.html (look for `baseLayer` constructor option, added 1.131).
- ADR-002: parent decision (CesiumJS as primary visualization stack).
- ADR-008: Sprint-1 frontend stack pin (cesium ^1.141.0 + resium ^1.21.0).

---

## Appendix A — Resium reference-stability gotchas

**Added 2026-05-06 after PR #88 commit `7527ed5` ("yellow polyline keeps flashing")**.

Resium 1.21 does **shallow-equal diffing** on `Entity` child props (`PolylineGraphics.material`, `PointGraphics.color`, `LabelGraphics.fillColor`, `CylinderGraphics.material`, etc.). When a prop's reference changes, Resium tells Cesium to recreate the entity → visible flicker. This is a quiet trap because Cesium primitives like `Color` and `Cartesian2` have value-equality semantics for the developer but reference-equality semantics for Resium's diff.

### Failure mode

Inline construction inside JSX:

```tsx
<PolylineGraphics
  material={Color.fromCssColorString("#fdcb6e")}     // 🚨 NEW Color per render
  positions={POLYLINE_POSITIONS}
/>
<LabelGraphics
  pixelOffset={new Cartesian2(0, -18)}                // 🚨 NEW Cartesian2 per render
/>
```

When the component re-renders (e.g. driven by a 50 ms playback `setInterval` updating `passFraction`), each render allocates new `Color` and `Cartesian2` instances. Resium's diff detects "prop changed" and Cesium recreates the geometry → polyline visibly flashes 20× per second.

The bug is asymptomatic when the component is static; it surfaces only when an unrelated state update (animation, polling, hover) re-renders the component.

### Pattern

**Static visuals**: hoist `Color`, `Cartesian2`, `Cartesian3` constants to module scope so the references are stable across all renders.

```ts
// Top of SatelliteView.tsx, OUTSIDE the component
const COLOR_POLYLINE = Color.fromCssColorString("#fdcb6e");
const PIXEL_OFFSET_LABEL_LARGE = new Cartesian2(0, -18);
const NYCU_GS_POSITION = Cartesian3.fromDegrees(120.998, 24.787, 30);

// Inside JSX
<PolylineGraphics material={COLOR_POLYLINE} ... />
<LabelGraphics pixelOffset={PIXEL_OFFSET_LABEL_LARGE} ... />
<Entity position={NYCU_GS_POSITION} ... />
```

**Dynamic visuals** (e.g. per-beam cone color that changes when SNR changes): wrap in `useMemo` keyed on the source data array. The result identity is preserved across renders that don't change the source.

```tsx
const stableCones = useMemo(
  () =>
    beamCones.map((cone) => ({
      ...cone,
      position: Cartesian3.fromDegrees(...),
      materialColor: Color.fromCssColorString(cone.color.hex).withAlpha(cone.color.alpha),
      outlineColor: Color.fromCssColorString(cone.color.hex),
    })),
  [beamCones],   // beamCones identity changes only on metrics-poll refresh (5 s)
);

{stableCones.map((cone) => (
  <Entity key={cone.beam_id} position={cone.position}>
    <CylinderGraphics material={cone.materialColor} outlineColor={cone.outlineColor} ... />
  </Entity>
))}
```

### Verify

For any future Cesium / Resium PR touching SatelliteView, run:

```bash
grep -nE 'Color\.fromCssColorString|new Cartesian2|Cartesian3\.fromDegrees' \
  services/digital-twin-ui/src/pages/SatelliteView.tsx \
  | grep -nE '<\w|return \(|<Viewer'
```

…to confirm zero such constructions remain inside JSX `return` blocks. The matching constructions should all sit at module scope or inside `useMemo`. SPEC-S004-13e §AC-S004-13e.8 codifies this as an explicit acceptance criterion for the redesigned page.

### Adjacent gotcha — ResizeObserver render loop

PR #88 commit `0cdee2b` added a `ResizeObserver` calling `viewer.resize()` to keep the canvas drawing buffer in sync with display size. Backed out in `cca042d` because it caused an infinite re-render loop (the `viewer.resize()` call somehow re-fired the observer). **Do not re-introduce ResizeObserver on the wrapper Box without re-validating with headless Chrome screenshot**; `CesiumWidget.render()` already auto-resizes the drawing buffer per frame when the canvas's `clientWidth/Height` differs from its drawing-buffer width/height — pure CSS (the `& canvas { 100% !important }` rule) is sufficient.
