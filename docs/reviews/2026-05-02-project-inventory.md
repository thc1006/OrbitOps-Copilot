# 2026-05-02 — full project inventory

| Field | Value |
|---|---|
| Auditor | Claude Code (auto-mode) under user direction (ultrathink request) |
| Trigger | User asked: "the UI doesn't fully expose backend capabilities — please re-inventory requirements vs implementation" |
| Scope | Whole project: backend metrics, Copilot endpoints, UI pages, CI, docs, submission deliverables, tech debt |
| Method | Concrete file reads + tool runs (not memory). Each finding cites file:line. |

This file is the persistent record of the inventory. The fixes that immediately
followed are tracked across multiple PRs:

| Fix | PR | Status |
|---|---|---|
| C7 install `exiftool` | n/a (system) | ✓ done 2026-05-02 |
| C8 README + PROJECT_STATUS sync | #44 | ✓ this PR |
| H.1.1 Beams elevation column | #45 | ✓ done |
| H.1.2 Anomalies 3 missing descriptions | #45 | ✓ done |
| H.1.3 Scenarios 3 presets loadable | #45 | ✓ done |
| H.1.4 Copilot risk_if_ignored + evidence metadata | #45 | ✓ done |
| Tier 3.A UI CI job | #46 | ✓ done |
| Tier 3.B SPECs Draft → Accepted | #46 | ✓ done |

## CRITICAL findings (shipping-blocker for RunSpace OR live demo broken)

| # | 問題 | 證據 | 影響 | 處理 |
|---|---|---|---|---|
| C1 | UI 不解析 `orbitops_beam_elevation_deg` | `api.ts::computeBeams()` switch 7 case 沒含 elevation | G7 全鏈完成，UI 不顯示 | ✓ PR #45 (H.1.1) |
| C2 | G6 RED metrics 在 UI 0 reference | `grep http_requests_total services/digital-twin-ui/src/` 返回空 | copilot-api self-health 在 UI 不可見 | deferred to Phase H.2 |
| C3 | `doppler_compensation_warning` UI 沒描述 | `Anomalies.tsx::ANOMALY_DESCRIPTIONS` 只 3 個 | G8 fired 時 UI 顯示 "Unknown anomaly type" fallback | ✓ PR #45 (H.1.2) |
| C4 | 3 scenarios 中只 1 個能從 UI 載 | Scenarios.tsx 只 import beam-degradation.json | bot 在 PR #41 也抓到；UC2 demo 從 UI 不可能 | ✓ PR #45 (H.1.3) |
| C5 | Pitch deck PDF 不存在 | `find . -name "pitch*.pdf"` 0 hits | RunSpace 投件需要 PDF deck | pending (user-only) |
| C6 | Demo 影片不存在 | 0 個 *.mp4 / *.mov | 投件需要 90s + 3min 影片 | pending (user-only) |
| C7 | `exiftool` 工具沒裝 | `which exiftool` 0 hits | CLAUDE.md §7 要求 metadata scrub 前必裝 | ✓ apt installed 2026-05-02 |
| C8 | README + PROJECT_STATUS 嚴重 stale | README 寫 "Sprint 0 skeleton (P0 in progress)"；PROJECT_STATUS 日期 2026-04-30 + "Sprint: 0 (closed) → 1 (planned)" | 評審打開 repo 第一頁讀到「Sprint 0」，實際已過 Sprint 1 大半 | ✓ this PR (#44) |

## MAJOR findings (spec/code drift or quality risk)

| # | 問題 | 處理 |
|---|---|---|
| M1 | CI 完全不跑 UI tests / build / lint | ✓ PR #46 (ui-build job) |
| M2 | ESLint config 缺 → `npm run lint` 在每台 dev 機器都 error | deferred (Sprint 2 ergonomics; needs new devDep) |
| M3 | 5/6 UI pages 0 test coverage | deferred to Phase H.2 |
| M4 | Copilot UI 缺 `risk_if_ignored` | ✓ PR #45 (H.1.4) |
| M5 | Copilot UI 缺 4/5 evidence 欄位 | ✓ PR #45 (H.1.4) |
| M6 | `/runbook` endpoint 無 UI surface | deferred to Phase H.2 |
| M7 | `/explain` endpoint 無 UI surface | deferred to Phase H.2 |
| M8 | Helm chart 嚴重不完整（只 2 service templates） | deferred (Sprint 2 VS-7) |
| M9 | `scripts/run-demo.sh` 仍是 Sprint 0 placeholder | deferred (Sprint 2) |
| M10 | Real LLM provider 仍 stub | deferred (Sprint 2 VS-8) |
| M11 | 3/5 emulator anomaly types UI 沒描述 | ✓ PR #45 (H.1.2) — added doppler_spike + packet_loss_spike + doppler_compensation_warning |
| M12 | Live cluster vs main image tag silent drift | accepted (development convention) |
| M13 | xfail strict 從沒解開 | deferred (S2-07 voice integration) |
| M14 | 7/7 SPEC docs 全部 Status: Draft | ✓ PR #46 |

## MODERATE / NIT findings (lower priority)

| # | 問題 | 處理 |
|---|---|---|
| H1 | backlog 有重複 VS-7 / VS-8 entries | deferred (next backlog cleanup pass) |
| H2 | VS-10 backlog 條目沒建（4 nits 從 PR #39/#42） | deferred |
| H3 | Bot service 不可靠 | external (no mitigation) |
| H4 | `make help` 沒列 `dev-up-with-ui` | minor; documented in PR #41 demo checklist |
| H5 | `scripts/k8s-up.sh` vs `k8s-up-local.sh` 命名混淆 | deferred |
| H6 | `/providers` endpoint 無 UI | deferred to Phase H.2 |
| N1-N4 | 4 nits deferred from PR #39 + #42 reviews | logged in `runspace-claims-audit.md` "Deferred nits" |

## What's left after this PR + #45 + #46

The 8 items resolved across the 3 PRs are **all the inventory items where the
fix fits in a doc-only or surgical-code change**. The remaining items split into:

- **User-only**: pitch deck PDF, demo videos, exiftool scrub of submission archive (`make archive`).
- **Sprint 2 scope**: real LLM provider, Loki, Helm chart full templates, ESLint, runbook UI, time-series Recharts, voice integration.
- **Phase H.2 scope** (UI completeness — round 2): `/runbook` + `/explain` + `/providers` UI surfaces, RED metrics widget, Recharts time-series, CesiumJS pass viz.
- **Hygiene**: backlog dedup, scripts naming, etc.

Phase H.1 (this round) closes the high-leverage subset. Phase H.2 is the natural
follow-up but explicitly out of scope for the 2026-05-02 ultrathink response.
