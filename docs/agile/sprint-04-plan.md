# Sprint 4 — Auth + Perf hardening + closed-loop design

| 欄位 | 值 |
|---|---|
| Status | Draft (2026-05-08) — awaiting user commit before kickoff |
| Duration | 1 週（建議 2026-05-09 ~ 2026-05-15） |
| Sprint goal | **「copilot-api 進入 auth-required 狀態（OIDC + JWT）；3 個 latency-critical endpoint 跑進 SLO budget（CI 阻擋 regression）；同時為 Sprint-5 closed-loop GitOps 出 SPEC + ADR 設計階段成果」** |
| Demo | `/login` page → token → `/copilot` ask still works；`scripts/perf-smoke.sh` green table；ADR-013 + SPEC-S006-VS21 + AC-S006-VS21 Sprint-5 spike-ready |

## Sprint goal restatement

讓 copilot-api 從「demo public」進入「production-readiness 第一階段」：
1. **Auth boundary**：所有 LLM-evidence-bearing endpoint 要 valid JWT（PyJWT 2.12.1 + RS256 + JWKS + mock-oauth2-server dev IdP）。`/healthz` `/metrics` 維持 public（不破 K8s probe + Prom scrape）。
2. **SLO budget**：emulator `/metrics`、copilot `/healthz`、copilot `/ask` (mock) 三 endpoint 有 measure-first p99/p95 budget；CI advisory gate 抓 regression。
3. **Closed-loop design**：Sprint-5 impl 之前先把所有設計問題逼出來——safe action surface、apply mechanism、approval flow、threat model、rollback 都在 SPEC + ADR 寫完。

## Vertical slices（recommended Option β）

| ID | Slice | 切到的層 | Est | SPEC | AC | 狀態 |
|---|---|---|---|---|---|---|
| **VS-19** | copilot-api OIDC + JWT auth (impl) | copilot-api(_auth.py + Depends + 13 tests) + UI(/login page + axios interceptors + 4 tests) + docker-compose(mock-oidc) + K8s overlay(local) | 3d | SPEC-S003-VS19 | AC-S003-VS19 (15 ACs) | committed |
| **VS-20** | Perf SLO baselines + CI gate (impl) | k6 1.0 (3 scripts) + scripts/perf-smoke.sh + verify.sh §6/6 advisory + docs/perf-slo.md + .github/workflows/ci.yml perf-smoke job | 2d | SPEC-S005-VS20 | AC-S005-VS20 (12 ACs) | committed |
| **VS-21** | Closed-loop GitOps reconcile (DESIGN PHASE only) | docs/specs/SPEC-S006-VS21 (already drafted) + docs/acceptance/AC-S006-VS21 (already drafted) + docs/adr/ADR-013 + docs/adr/ADR-004 closed-loop clause extension | 1d (mostly done in this draft PR) | SPEC-S006-VS21 | AC-S006-VS21 §A (8 design ACs) | committed (deliverable: SPEC + AC + ADR-013) |

**Total 6d**（含 carry-overs / weekend buffer，1 週可完成）。

## Sprint scope alternatives surfaced for user override

| Option | VS-19 | VS-20 | VS-21 | Total |
|---|---|---|---|---|
| **β (recommended)** — impl 2 + design 1 | impl | impl | design only | 6d |
| α — impl all 3 | impl | impl | impl (Sprint-5 work shoved into Sprint-4) | 9–13d ❌ over budget |
| γ — impl 1 + design 2 | impl | design only | design only | 4d ✅ very safe but only 1 capability lands |
| δ — defer all auth + perf, design closed-loop only | — | — | full design (extended) | 2d (would leave Sprint-4 nearly empty) |

**Architect recommends β**. user 若想押 α 必須接受 60%+ scope 風險；γ 是 risk-averse 路線；δ 不推薦（deliverable 太薄）。

## Acceptance gates

- [ ] AC-S003-VS19 全 15 條 ACs 綠 (含 `pytest services/copilot-api/tests -q` ≥ 122 passing；UI vitest 加 4 條 auth-related 通過)
- [ ] AC-S005-VS20 全 12 條 ACs 綠 (含 `scripts/perf-smoke.sh` exit 0；`docs/perf-slo.md` 數字皆 measured 非 TBD)
- [ ] AC-S006-VS21 §A 全 8 條 design-phase ACs 綠 (SPEC-S006-VS21 + AC-S006-VS21 + ADR-013 + ADR-004 closed-loop clause 全 commit)
- [ ] `make verify` 全綠（9 blocking + 4 advisory；§6/6 perf 為新增 advisory）
- [ ] `scripts/check-no-secrets.sh` clean（特別注意 PyJWT signing key 不可入 repo；走 env / Secret）
- [ ] anti-pattern self-audit on 每個 PR（CLAUDE.md §13.3 已強制）

## Risks

| ID | Risk | Mitigation |
|---|---|---|
| S4-R1 | mock-oauth2-server 在 K8s overlay 行為不一致（compose path vs K8s path） | 寫 cross-overlay smoke test；compose 跑通後立刻在 kind 重跑 |
| S4-R2 | k6 CI runner 數字 noisy → false threshold breach | Sprint-4 advisory 模式 + Sprint-5 加 retry-once；docs/perf-slo.md 寫明 caveat |
| S4-R3 | PyJWT JWKS 拉取在 air-gapped CI 失敗（ghcr.io 拉不到 mock-oidc image） | Pre-pull image to local registry；CI cache + retry |
| S4-R4 | VS-19 + VS-20 重疊（perf 跑 /ask 需要 token；先做 VS-19 再 VS-20） | sprint-04 先 land VS-19 再 land VS-20；若 VS-20 先到，scripts/perf-smoke.sh 用 `JWT_REQUIRED=false` transitional state（記錄在 docs/perf-slo.md） |
| S4-R5 | VS-21 ADR-013 採取 Kargo 路線但 Kargo install footprint 太大（kubeadm single-node 跑不動） | Sprint-5 第一天先 spike Kargo install size；若 footprint 過大，ADR-013 改成「stub Kargo step + 直接 ArgoCD sync after manual approval」 |
| S4-R6 | 7+1 anti-pattern self-audit 變新 ceremony（PR overhead） | PR template 已 inline；每條 N/A 即可；ceremony cost ≤ 5 min/PR |

## Dependencies

- VS-19 必須先於 VS-20 land（perf 測 /ask 需要 token）；若反了則進入 transitional state（見 S4-R4）
- VS-21 design 不依賴 VS-19/VS-20（純 docs）；可平行開
- ADR-004 closed-loop clause 必須與 ADR-013 同 PR commit（避免 cross-doc drift）

## Sprint demo（dry-run, no submission）

1. `make dev-up`（含 mock-oidc service）
2. UI 開 `/`，未 authed → redirect `/login`
3. login `demo:demo` → 取 token → 到 `/scenarios` load beam-degradation
4. 跳 `/copilot` ask "Which beam is degrading?" → 還是有 evidence response（auth 不破 grounding）
5. 終端跑 `scripts/perf-smoke.sh` → 看到 3 個 scenario 的 p50/p95/p99 + budget 表
6. 開 `docs/specs/SPEC-S006-VS21-*.md` + `docs/adr/ADR-013-*.md` review setting → 解釋 Sprint-5 的 design 已就緒

## DoD（per CLAUDE.md §11 + sprint-review-template）

- 寫 `docs/agile/sprint-04-review.md`（用 template）
- 更新 `docs/agile/risk-register.md`（任何 R-* re-score）
- 更新 `docs/agile/backlog.md`（Sprint-4 outcome callout）
- 更新 memory `sprint4_state_2026-05-XX.md`
- 釋出 `v0.1.4-dev-sprint4` tag（若有 user-facing capability change，這次 auth 算）

## Anti-pattern accountability (sprint level)

每個 PR 走 `docs/reviews/anti-pattern-checklist.md` 7+1 self-audit（CLAUDE.md §13.3）。Sprint-4 特別關注：
- **Chain #6 partial-migration**: VS-21 closed-loop §5.1 的 3 個 action 在 Sprint-5 ship 必須一起，不可分批
- **Chain #X process**: 任何 visual regression 在 UI auth flow 需先寫 test，不要再 PR #88 般追跑 8 commits

## Open commitments

user 開 sprint 前確認：
1. 接受 β（impl VS-19 + VS-20 + design VS-21）— 還是改 α / γ / δ？
2. 接受 PyJWT + RS256 + mock-oauth2-server 技術選型（research 驗 2026-05-08）— 還是改？
3. 接受 k6 1.0 OSS 為 perf gate tool — 還是改 Locust / Vegeta？
4. 接受 closed-loop 走 git-commit-PR + Kargo + ArgoCD 路線（KubeCon EU 2026 consensus）— 還是改？

回答完就開工。
