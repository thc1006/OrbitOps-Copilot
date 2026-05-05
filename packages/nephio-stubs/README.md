# Nephio stubs — `orbitops-groundstation-package`

> Per **ADR-005**: this directory provides a **kpt package skeleton** demonstrating Nephio R5 GitOps idioms for an OrbitOps ground-station deployment. It is **not** a fully functional Porch / O-RAN O2 IMS / FOCOM lifecycle.
> Per **AGENTS.md** k8s-platform-engineer rules: never claim Nephio is fully wired.

## What this stub IS

- A `Kptfile` with package metadata aligned to Nephio R5 naming conventions
- A `package-context.yaml` (`local-config`-annotated ConfigMap) with package-scoped settings
- A `GroundStationProfile` CR-shaped descriptor (`groundstation-profile.yaml`) that captures the operator's intent for one ground station — `station_id`, `location`, `supported_bands`, `beam_profiles[]`, `gateway_profiles[]`, `observability_endpoints`
- A JSON twin of the same profile (`groundstation-profile.example.json`) validated by `tests/contracts/groundstation-profile.schema.json` in `make verify`
- A `kpt fn render` smoke run completes cleanly (no mutators/validators)

## What this stub IS NOT

- A real Nephio Porch deployment
- An O-RAN O2 IMS `ProvisioningRequest` reconciler
- A FOCOM-managed O-Cloud inventory record
- A SMO interface
- Any RAN/NTN testbed
- Anything that touches a workload cluster automatically

The package would be **consumable** by a real Porch repository, but Sprint 1 ships the **shape**, not the **lifecycle**. Wiring the lifecycle is documented in `docs/future/nephio-o2ims-integration.md`.

## Layout

```
packages/nephio-stubs/orbitops-groundstation-package/
├── Kptfile                                # kpt package metadata
├── .krmignore                             # excludes the JSON twin from kpt's resource walker
├── package-context.yaml                   # local-config; package-scope ConfigMap
├── groundstation-profile.yaml             # GroundStationProfile CR (kind annotation only)
├── groundstation-profile.example.json     # JSON twin validated by verify.sh
└── README.md                              # this file
```

The `.krmignore` exclusion exists because `kpt fn render`'s resource
walker treats every file in the package as a candidate KRM resource and
rejects the JSON twin (no `apiVersion` / `kind` — by design; it's a
profile descriptor, not a Kubernetes object). See `.krmignore` header.

## Schema

`tests/contracts/groundstation-profile.schema.json` (Draft 2020-12) defines:

| Field | Type / Constraint |
|---|---|
| `station_id` | string matching `^gs-[a-z0-9-]{2,40}$`; matches `scenario.ground_station_id` |
| `location` | `{lat,lon,alt_m,country_code}` (ISO 3166-1 alpha-2) |
| `supported_bands` | non-empty array of `{S\|X\|Ku\|Ka\|Q\|V}` |
| `beam_profiles[]` | per-beam: `beam_id`, `band`, `boresight_az_deg`, `boresight_el_deg`, `hpbw_deg`, optional `max_eirp_dbw` |
| `gateway_profiles[]` | `gateway_id`, `role∈{primary,backup}`, optional `throughput_mbps` |
| `observability_endpoints` | `prometheus_url` (required) + optional `grafana_url`, `loki_url` |

`make verify` (gate 4) validates `groundstation-profile.example.json` against this schema. Any drift between YAML and JSON twins (i.e. the kpt-resource and its demo JSON form) breaks CI.

## Verify locally

Two gates fire on this package via `./verify.sh`:

```bash
# 1. JSON-schema gate (verify.sh §4) — validates groundstation-profile.example.json
.venv/bin/python scripts/validate_schemas.py
# Expect: "ok   gs-profile:   ..." in the output

# 2. kpt fn render gate (verify.sh §5d, AC-S006-7) — dry-runs the package
kpt fn render packages/nephio-stubs/orbitops-groundstation-package/
# Expect: "Successfully executed 0 function(s) in 1 package(s)."
```

The kpt gate is **soft** (advisory) when kpt isn't on PATH so contributors
without kpt installed don't get a false-fail; CI without kpt prints a warn
line. Install kpt from <https://kpt.dev/installation/> to run the gate
locally. Once kpt lands in the CI image, the gate's `warn` flips to `fail`
and AC-S006-7 becomes blocking.

## How a downstream Porch repo would consume this

The package is `kpt pkg get`-able as-is. Once a real Porch deployment
exists (deferred to P2 — see `docs/future/nephio-o2ims-integration.md`),
the consumer flow is:

```bash
# In a downstream blueprint repo:
kpt pkg get \
  https://github.com/thc1006/OrbitOps-Copilot.git/packages/nephio-stubs/orbitops-groundstation-package@main \
  blueprints/orbitops-gs-tw-01

# Edit groundstation-profile.yaml to override station_id, location, etc.
# (Sprint-1: hand-edit. Sprint-3+: setters / fn-gen variants.)

# Render + (when O2 IMS lifecycle exists) push:
kpt fn render blueprints/orbitops-gs-tw-01
kpt alpha rpkg push --repository=oran-blueprints blueprints/orbitops-gs-tw-01
```

The pipeline today renders cleanly because `Kptfile.pipeline` ships
empty `mutators: []` / `validators: []` — there is no business logic
to gate the render. When real KRM functions land (e.g. an
`apply-replacements` setter for `station_id`, or a validator that
checks `lat ∈ [-90, 90]`), they go in `Kptfile.pipeline` and become
part of the AC-S006-7 dry-run automatically.

## What to claim — and not claim — when presenting this work

✅ "We ship a Nephio R5-shaped kpt package describing the ground station, with a JSON-schema-validated profile."
✅ "The schema is the contract that connects Sprint-1 in-process emulation to Sprint-3+ real Porch/O2 IMS deployment."
❌ "We've integrated with Nephio Porch."
❌ "Our O-RAN O2 IMS conformance is complete."
❌ "FOCOM discovers our ground stations automatically."

## Roadmap

`docs/future/nephio-o2ims-integration.md` — concrete steps to take this stub to a real Porch + O2 IMS + FOCOM pipeline.
