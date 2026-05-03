# OrbitOps Copilot — TODO list

> **2026-05-03** post-Sprint-2 audit + 2026-05 software-stack research.
> main @ `f7652d2`; 16 PR shipped (#44–#59).
> User-skipped items NOT listed: VS-8 (real LLM, no GPU) / VS-12 (voice stub) / VS-14/15/16/18 (RunSpace 投件).
> See `~/.claude/.../memory/{sprint2_state_2026-05-03,user_skip_rules}.md`.

---

## 🚨 Tier 0 — Security / EOL emergencies (must do)

> Found by 2026-05 stack research. **NOT discovered in earlier audits**.
> All 3 are out-of-scope for the TDD red→green CI gate (no `services/**/*.py|.ts|.tsx` touched).

| ID | What | CVE / EOL | Bump | Files | Est |
|---|---|---|---|---|---|
| **U1** | **Prometheus 3.5.0 → 3.11.3** — two High CVE explicitly affecting 3.5.0 | CVE-2025-13465 (CVSS **8.8** prototype pollution) + CVE-2025-12816 (CVSS **8.6** crypto-verification bypass) | 3.5.0 → 3.11.3 | `deploy/k8s/base/prometheus-deployment.yaml` (or values.yaml depending on chart shape) + `deploy/docker-compose.yml` + `deploy/helm/orbitops-copilot/values.yaml` (`prometheus.image.tag`) | 30 min |
| **U2** | **Grafana 11.4.0 → 13.0.1** — multiple CVEs in 11.4.0 (or minimum bump 11.4.3+) | CVE-2025-3260 (High XSS) / CVE-2025-2703 / CVE-2025-3454 / CVE-2025-6023 (XSS High) | 11.4.0 → 13.0.1 | same 3 surfaces as U1 | 30 min (+ 1 h to verify provisioned dashboards still render — Grafana 11→13 has dashboard schema-v2 changes) |
| **U3** | **Promtail 3.4.0 → Grafana Alloy** — promtail was EOL **March 2026** (we added EOL software in PR #56!) | EOL not CVE; Grafana Labs **requires** migration | replace promtail container with `grafana/alloy:latest`; rewrite `observability/promtail/promtail-config.yaml` → `observability/alloy/config.alloy` | + ADR-010 documenting the pivot + update `docs/03_breakthrough_directions.md` if it referenced promtail | 2-3 h (config rewrite + new container in compose) |

**🚨 Tier 0 is one PR.** U1+U2 are 1-line tag bumps; U3 is a small config rewrite + ADR-010. All out-of-scope for TDD gate. Test plan: `docker compose up`, verify Prom scrape + Grafana datasource still works, verify Alloy ships logs to Loki, `verify.sh 5b/5` green.

---

## 🔴 Tier P0 — Production-drift (must do before next demo)

| ID | What | TDD scope | Est |
|---|---|---|---|
| **D1** | **Docker image tag drift** — main pins `0.1.1-dev-g6g7g8` (pre-PR-#51); 7 Sprint-2 PRs (`/anomaly/inject` / JSON logging / LokiLogScraper / UI inject / charts / sparkline) NOT in image. Live cluster runs old code. | out-of-scope (deploy/k8s/base + values.yaml + Dockerfile builds) | 1.5 h (rebuild + push + redeploy) |
| **D2** | **Loki+promtail no K8s overlay** — VS-10b.1 deferred K8s parity; never added back to backlog. K8s path AC-S005-5 still unmet. | out-of-scope (deploy/k8s/base + Helm templates) | 2 h |
| **D3** | **UI inject button 404 on live cluster** — connected to D1; emulator pod has no `/anomaly/inject`. | resolves with D1 | — |

**Recommend:** combine D1+D2+U3 into ONE PR — same surface area (deploy/k8s/base/ + helm templates + image tags), saves rebuild cost. ADR-010 (alloy pivot) attached.

---

## 🟡 Tier P1 — Sprint-3 code work (TDD red→green required)

> All these touch `services/**/*.{py,ts,tsx}` → CI `tdd-discipline` job blocks PR without `red(SPEC-NNN):` ancestor commit.

### VS-13 — CesiumJS satellite pass viz (revised after research)

| ID | What | TDD plan | Est |
|---|---|---|---|
| **S1.0** | **Pre-step: Node 20 → 22** in CI (`.github/workflows/ci.yml setup-node@v4 version`) + `services/digital-twin-ui/package.json engines.node` | out-of-scope (CI YAML + package.json — non-test field) | 30 min |
| **S1.1** | **Frontend stack-bump red commit** — vitest tests for "old assertions still pass" + new tests for breaking-change surfaces (e.g. `<RouterProvider>` Data API in router 7) | red(SPEC-004): write failing tests anticipating router 7 / vitest 4 / React 19 surface | 2 h |
| **S1.2** | **Stack-bump green commit** — package.json upgrades:<br>`react@^19.2.5` + `react-dom@^19.2.5`<br>`vite@^8.0.10` + cross 5→6→7→8 plugin/SSR API fixes<br>`typescript@^6.0.3`<br>`vitest@^4.1.5` + cross 2→3→4 config/chai-API fixes<br>`@testing-library/react@^16.3.2` (required for React 19 typings)<br>`recharts@^3.8.1` (React 19 compat)<br>`react-router@^7.14.2` (Data Router migration — non-trivial)<br>**Skip @mui/material 6→9** for now (3 majors deferred Sprint-4) | green: 83 vitest must stay green | 1-2 days |
| **S2** | **VS-13.2 — CesiumJS skeleton** — `cesium 1.141` + `@cesium/vite-plugin`; `<SatellitePassViz />` empty globe; route-level lazy import | red: failing test for `<SatellitePassViz />` rendering globe div with cesium attributes; green: implement | 2 h |
| **S3** | **VS-13.3 — Pass animation** — sin-shaped elevation → Cesium `PolylineGraphics`; `t_seconds` sync | red→green | 2 h |
| **S4** | **VS-13.4 — Beam coverage cone** — per-beam `EllipsoidGraphics` + snr_db color (red/yellow/green) | red→green | 1-2 h |
| **S5** | **VS-17 — Nephio kpt full doc** — `packages/nephio-stubs/` doc + `kpt fn render` dry-run; AC-S006-7 met | out-of-scope (no services/*) | 0.5 d |

---

## 🟡 Tier P2 — issues.md + risk register cleanup

| ID | What | TDD scope | Est |
|---|---|---|---|
| **C1** | **I-8 — `tests/k8s-smoke/healthz.sh`** — `make kind-up` + apply + wait ready + curl /healthz; CI uses kind-action | out-of-scope (tests/k8s-smoke/ is shell, not source code per scope filter) | 1 h |
| **C2** | **I-6 — Grafana harden** — admin password → Secret; non-local overlay disables anonymous; SECURITY.md S-3 update | out-of-scope (deploy + docs) | 30 min |
| **C3** | **I-5 — ruff blocking** — flip warn-only to blocking in verify.sh + CI | out-of-scope (verify.sh) | 15 min |
| **C4** | **I-10 — claims-audit in CI** — promote 1c advisory grep to a CI gate or independent job | out-of-scope (.github/workflows) | 30 min |
| **C5** | **I-11 — package-lock.json glob exclusion** — change explicit list to glob in scripts/check-no-secrets.sh | out-of-scope (scripts/) | 5 min |
| **C6** | **I-12 — OpenAICompatibleProvider injection-guard reverification** — paired with VS-8; still deferred (no GPU) | — | — |

---

## 🟢 Tier P3 — doc / contract debt

| ID | What | TDD scope | Est |
|---|---|---|---|
| **T1** | **D7 i18n migration** — bootstrap `services/digital-twin-ui/src/i18n/`; back-fill ~12 hardcoded English strings; key-sync test; AC-S004-5 met | **in-scope** (touches services/digital-twin-ui/src/) → red→green required | 2-3 h |
| **T2** | **PROJECT_STATUS.md refresh** — date stuck at 2026-05-02; image table needs new tag (post D1); add Loki+promtail (compose only, K8s parity deferred) | out-of-scope | 15 min |
| **T3** | **docs/exec-plans/tech-debt-tracker.md missing** — CLAUDE.md §13.3 references it; either create or remove the reference | out-of-scope | 10 min |
| **T4** | **README CLI examples** — `make verify` / `make k8s-reload-observability` / `make archive` actual output samples | out-of-scope | 30 min |
| **T5** | **Recharts 3 migration** (now bundled into S1.2 stack-bump above) | — | included in S1 |

---

## 🔵 Tier P4 — Risk register half-yearly review

`docs/agile/risk-register.md` R-01 to R-12 全 Open。次序建議：

| Risk | 動作 | TDD scope |
|---|---|---|
| **R-04** 版本漂移 | 立即關掉(降至 mitigated)，因為 ADR-008 + 上面 S1.x 已 cover；研究後 explicitly identify Helm/Grafana/Prom CVE pinning | doc-only |
| **R-12** hooks 誤刪 | 已 mitigated；不動 | — |
| **R-08** LLM 斷線 | VS-8 deferred (no GPU)；mock provider 永遠 fallback；可降 priority | — |
| 其餘 | Sprint-3 / 投件前一輪逐個 walk through | — |

---

## ✅ 已完成（snapshot）

Sprint-1 全 (VS-1..6) + Sprint-2 VS-7/9a/9b.1-4/10a/10b.1-2/11 + I-3/I-4/I-9 RESOLVED + ADR-009 + TDD CI gate + post-Sprint-2 housekeeping.

---

# 📋 推薦執行順序（含 TDD scope）

## Phase A: 安全 + drift 一次清乾淨（1 個 PR / ~5 h）

合併 **U1 + U2 + U3 + D1 + D2** 成單 PR，命名 `chore/sprint-2-prod-cve-drift-fix`：

- Bump Prometheus tag 3.5.0 → 3.11.3（U1，2 high CVE）
- Bump Grafana tag 11.4.0 → 13.0.1（U2，4 CVE）
- 取代 promtail → Grafana Alloy（U3，EOL）+ 寫 ADR-010 documenting pivot
- Rebuild emulator/copilot/UI docker image，bump tag `0.1.1-dev-g6g7g8` → `0.1.2-dev-sprint2`（D1）
- 加 `deploy/k8s/base/{loki,alloy}-{deployment,service,configmap}.yaml` + Helm templates（D2，含 alloy）
- 加 `ORBITOPS_LOKI_URL` env var on copilot deployment（K8s 也 populate logs_used）
- 對應 update PROJECT_STATUS.md + verify.sh 5b/5 green + helm template + ADR-009 contract

**TDD scope**: 全 out-of-scope（純 deploy/observability/docs YAML + image tags）。**不需** red→green。
**測試plan**: `docker compose up` 全綠 / `kubectl rollout restart` 後 pod ready / `/ask` 在 K8s 上 logs_used 不再是 [].

## Phase B: 小 cleanup 連發（單 1 PR / ~2 h）

C5 (5 min) + C3 (15 min) + C2 (30 min) + C1 (1 h) + T2/T3 (25 min) 合一個 housekeeping PR。全 out-of-scope TDD。

## Phase C: VS-13 stack bump（單獨 PR / 1-2 整天）

**S1.0 → S1.1 → S1.2** 一個 PR 走完整紅→綠：

```
red(SPEC-004): VS-13.1 — failing tests for React 19 / Vite 8 / Vitest 4 / router 7 surface
green(SPEC-004): VS-13.1 — bump frontend stack to 2026-05 latest
```

完成後 83 vitest 全綠 + Node 22 in CI + bundle size acceptable.

## Phase D: VS-13 CesiumJS 三段式（3 個 PR）

**S2** → **S3** → **S4** 各自獨立紅→綠。每個 ~2 h。

## Phase E: 投件前最後體檢（half day）

P3 T1 i18n（最後做，不影響 demo）+ P2 C4（claims-audit in CI）+ P4 risk register walk-through。

---

# 🎯 立即建議

**今晚先做 Phase A**（安全 + drift 5 in 1 PR）。理由：
- Tier 0 安全 CVE 不可拖（Prom 8.8 + 8.6 / Grafana 11.4 多 CVE）
- promtail EOL 是我自己 PR #56 加的 EOL 軟體，越久越尷尬
- D1+D2 修了 demo 就能在 live cluster 走全套 Sprint-2 體驗
- 全 out-of-scope TDD，不需紅→綠 chain，速度快

Phase A 完成後 main 才是真正「Sprint-2 整套上線」的狀態。Phase B-E 之後再規劃。
