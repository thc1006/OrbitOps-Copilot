# OrbitOps Copilot — TODO list

> **2026-05-04** post-Phase-A/B/VS-10c sweep. main @ `4dff1a0`; **20 PR shipped** (#44–#63).
> User-skipped items NOT listed: VS-8 (real LLM, no GPU) / VS-12 (voice stub) / VS-14/15/16/18 (RunSpace 投件).
> Per-session memory of sprint state lives in Claude Code's auto-memory (path is per-machine; not a tracked repo path); the cross-session source-of-truth for skip rules is CLAUDE.md §10 "Forbidden scope".

---

## ✅ Closed in this session (2026-05-03/04)

### Phase A — Tier-0 security / EOL / drift (PR #60, merged)
- U1 Prometheus 3.5.0 → 3.11.3 (CVE 8.8 + 8.6 fix)
- U2 Grafana 11.4.0 → 11.4.3 (CVE-2025-3260 + others fix)
- U3 promtail → Grafana Alloy v1.6.1 (EOL March 2026 fix; ADR-010)
- D1 image tag bump 0.1.1-dev-g6g7g8 → 0.1.2-dev-sprint2 (3 OrbitOps images)
- D2 Loki + Alloy K8s overlay parity

### U7 — live-cluster fixes (PR #61, merged)
- Alloy K8s discovery: `__meta_kubernetes_pod_container_name` (non-existent for role=pod) → `__meta_kubernetes_pod_label_app_kubernetes_io_name` + `orbitops-` prefix relabel
- copilot-deployment.yaml: actually wire `ORBITOPS_LOKI_URL=http://loki:3100` (PR #60 commit msg claimed it but edit didn't land)
- alloy-configmap.yaml: doc warning about kustomize-only apply path

### VS-10c — uvicorn-aware logging (PR #62, merged)
- Both services' `_logging.py` now also clears uvicorn-namespace handlers + sets propagate=True
- Test contract: post-`setup_logging()`, uvicorn.access records emit JSON-parseable lines on root's JsonFormatter
- Closes the live-cluster pod-stdout-mixed-format issue surfaced by U7 verification

### Phase B — issues batch (PR #63, merged)
- I-5: ruff blocking (was warn-only; verify.sh + CI both flipped)
- I-6: Grafana harden via prod overlay template (secretKeyRef + GF_AUTH_ANONYMOUS_ENABLED=false)
- I-8: tests/k8s-smoke/healthz.sh — verified live: 7/7 deployments + 3/3 /healthz 200
- I-10: claims-audit promoted from advisory to blocking CI job
- I-11: lock-file glob exclusion in scripts/check-no-secrets.sh

### Live-cluster verification
- 7 OrbitOps deployments running new image tags + new versions (Prom 3.11.3, Grafana 11.4.3, Alloy 1.6.1)
- `/anomaly/inject` endpoint live (PR #51's first true cluster smoke)
- `/ask` end-to-end: status=ok, evidence.metrics_used = **1 citation** (orbitops_beam_snr_db on beam-1), evidence.logs_used = **100 log lines** from Loki (AC-S005-5 met on K8s path)
- Loki sees all 6 services labeled `orbitops-*`

---

## 🟡 Tier P1 — Sprint-3 code work (user-approved scope)

### VS-13 CesiumJS satellite pass viz (revised after 2026-05-03 stack research)

| ID | What | TDD scope | Est | Risk |
|---|---|---|---|---|
| **S1.0** | Pre-step: Node 20 → 22 in CI + package.json engines | out-of-scope (CI/package.json non-test field) | 30 min | Low |
| **S1.1** | Frontend stack-bump red commit — failing tests for router 7 / vitest 4 / React 19 surface | red(SPEC-004) | 2 h | High |
| **S1.2** | Stack-bump green: react@^19.2.5 / vite@^8.0.10 / typescript@^6.0.3 / vitest@^4.1.5 / @testing-library/react@^16.3.2 / recharts@^3.8.1 / react-router@^7.14.2 | green | 1-2 days | High |
| **S2** | VS-13.2 — CesiumJS install + skeleton | red→green | 2 h | Medium (3 MB bundle, wasm/worker) |
| **S3** | VS-13.3 — Pass animation (sin-shaped → PolylineGraphics) | red→green | 2 h | Low |
| **S4** | VS-13.4 — Beam coverage cone (per-beam EllipsoidGraphics + snr_db color) | red→green | 1-2 h | Low |
| **S5** | VS-17 — Nephio kpt full doc (`packages/nephio-stubs/` doc + `kpt fn render` dry-run; AC-S006-7 met) | out-of-scope | 0.5 d | Low |

---

## 🟡 Tier P3 — doc / contract debt (no functional impact)

| ID | What | TDD scope | Est |
|---|---|---|---|
| **T1** | D7 i18n migration — bootstrap `services/digital-twin-ui/src/i18n/`; back-fill ~12 hardcoded English strings; key-sync test; AC-S004-5 met | **in-scope** → red→green | 2-3 h |
| ~~T2~~ | ~~PROJECT_STATUS.md refresh — done in PR #65~~ | ~~out-of-scope~~ | ~~done~~ |
| ~~T3~~ | ~~docs/exec-plans/tech-debt-tracker.md~~ — false alarm: that reference lives in the parent nycu-bus workspace's CLAUDE.md, not this repo's. Confirmed in PR #65 body. No work needed. | — | done (no-op) |
| ~~T4~~ | ~~README CLI examples — done in PR #65~~ | ~~out-of-scope~~ | ~~done~~ |

---

## 🔵 Tier P4 — Risk register half-yearly review

`docs/agile/risk-register.md` R-01..R-12 全 Open. Suggest revisit:
- **R-04** (版本漂移) — partly mitigated by ADR-008; remaining for VS-13.x stack bump
- **R-12** (hooks misuse) — already Mitigated
- 其餘 10 個 — Sprint-3 / 投件前 walk-through (skipped per user no-投件 policy)

---

## 🟢 Open issues (all by-design or user-skipped)

- **I-7** voice-interface xfail (VS-12 backlog; user-skipped, no GPU)
- **I-12** OpenAICompatibleProvider injection guard (VS-8 paired; user-skipped)

---

## 📊 Cumulative shipped

20 PRs from `#44 (docs sync)` → `#63 (Phase B issues batch)`.

| Sprint area | PRs | Outcome |
|---|---|---|
| UI / VS-9 family (b.1/b.2/b.3/b.4) | #45/#46/#52/#53/#54/#58 | inject UI + Recharts time-series + Copilot sparkline |
| Helm / VS-7 / VS-11 / ADR-009 | #47/#48/#50 | full chart + bare service names + ArgoCD reference |
| TDD CI gate (PR #49) | #49 | I-3 closed; red→green blocking |
| Emulator inject (VS-9a) | #51 | /anomaly/inject endpoint |
| VS-10 Loki path (10a/10b.1/10b.2/10c) | #55/#56/#57/#62 | structured logging + Loki + LogScraper + uvicorn-aware |
| Sprint-2 housekeeping | #59 | doc-drift cleanup |
| Phase A / U7 / Phase B | #60/#61/#63 | CVE patches + image bump + EOL migration + 5 issues batch |

---

## 🎯 Next steps (recommended)

After 2 days non-stop sprint-2 hardening, suggest taking one of:

1. **(low effort) T2 + T3 + T4** — refresh PROJECT_STATUS.md / fix tech-debt-tracker reference / add CLI examples. ~1 hr total. Out-of-scope TDD.

2. **(big effort) S1.0+S1.1+S1.2** — Sprint-3 frontend stack bump. 1-2 整天 工作量, in-scope TDD red→green. High risk: 5 major version jumps interact.

3. **(medium effort) T1 i18n** — bootstrap i18next; back-fill UI strings; AC-S004-5 met. 2-3 hr, in-scope TDD.

4. **Pause + reflect.** Sprint-2 P0 + Tier-0 security + EOL all closed. Let it sit, demo it as-is.

Personal recommendation: **Option 1** today (refresh stale docs to capture today's work), then plan VS-13 for next session when fresh.
