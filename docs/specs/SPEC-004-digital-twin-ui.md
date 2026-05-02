# SPEC-004 — digital-twin-ui

| Field | Value |
|---|---|
| Status | Accepted (Sprint 1 — substantively shipped 2026-05-02) |
| Owner | architect + observability-engineer |
| Sprint | 1 (VS-1, VS-3) + Sprint 2 (VS-9) + Sprint 3 (VS-13) |
| Depends on | SPEC-002, SPEC-003 |
| Related ACs | AC-001, AC-002 (UI parts) |

## 1. User story

> 作為 RunSpace 評審或 ground-station operator，我想要在瀏覽器看到一個 **B5G LEO 地面站運維的 digital twin**：satellite pass 動畫、3 個 beam 狀態、anomaly banner、Copilot 對話面板、5-step runbook——**這樣我** 不必下指令就能直觀理解這個 sandbox 在做什麼。

## 2. Problem

純 Grafana dashboard 無法表達 satellite pass 的時空維度與 Copilot 的對話互動；純 Copilot CLI 又缺視覺化說服力。本 UI 是兩者的整合體：左側時序圖（呼 Prometheus）、右側 Copilot panel（呼 copilot-api）、底部 anomaly banner、頂部 satellite pass viz（Sprint 3 才有 CesiumJS）。

## 3. Scope

- React 19 + Vite 8 + TypeScript 6 + Tailwind 4 + Recharts。
- **Sprint 1**：UI shell + `<CopilotPanel />` + 顯示 evidence JSON viewer + `<RunbookView />` 摺疊（VS-1 + VS-3）。
- **Sprint 2**：時序圖 + anomaly inject 按鈕（VS-9）。
- **Sprint 3**：CesiumJS 1.140 satellite pass + beam coverage cone（VS-13）。
- i18n：英文為主（en），保留 zh-TW 槽。

## 4. Non-scope

- 不接真 user authn / authz（demo 沙箱）。
- 不做 admin / settings page。
- 不做 mobile-responsive 細部（桌機優先）。
- 不接真 CesiumJS 之外的 3D 引擎（Three.js 為備案，不主用）。
- 不存 user state（無 localStorage 對話歷史）。

## 5. Inputs

- 環境變數：`VITE_API_BASE_URL`（copilot-api）、`VITE_EMULATOR_BASE_URL`、`VITE_PROMETHEUS_BASE_URL`。
- User keystrokes / clicks（CopilotPanel 輸入；anomaly inject 按鈕）。
- HTTP responses from copilot-api / emulator / Prometheus。

## 6. Outputs

- 渲染的 React UI（瀏覽器頁面）。
- 對 copilot-api 的 `POST /ask` / `/explain` / `/runbook` 請求。
- 對 emulator 的 `POST /anomaly/inject` 請求（VS-9）。
- 對 Prometheus 的 PromQL 查詢（VS-9 時序圖）。

## 7. API or file contracts

**Pages**：

| Path | 內容 |
|---|---|
| `/` | Dashboard：pass timeline、beam panel、anomaly banner、CopilotPanel |
| `/scenario/:id` | Scenario detail page |
| `/copilot` | 全屏 Copilot 對話 |
| `/about` | 版本、來源、許可（**匿名**） |

**Components**：

- `<CopilotPanel />`：textarea + send button → render `CopilotResponse`（answer + evidence JSON viewer）。
- `<RunbookView />`：5 個 collapsible section。
- `<AnomalyBanner />`：紅 / 橘色提示，從 emulator 的 `orbitops_anomaly_active` 推。
- `<TimeSeriesChart />`（VS-9）：Recharts；y 軸單位 dB / ms / Hz。
- `<SatellitePassViz />`（VS-13）：CesiumJS。

**Demo affordances** (Scenarios page, VS-8 full)：

- "Load preset" button — load `beam-degradation-001` only (t=0, no tick).
- "Tick + Ns" button + ButtonGroup quick-picks (10/30/60/90 s) — manual time advance.
- **"Ready for Copilot"** button (one-click) — combines `loadScenario` + `tickScenario(90)` into a single action so a fresh demo session lands inside the snr_drop window (t=60..150) and `/ask` never returns `INSUFFICIENT_EVIDENCE` on the first question. Closes the UX nit raised in `docs/reviews/demo-path-audit-2026-05-01.md`. Test contract pinned in `services/digital-twin-ui/src/pages/Scenarios.test.tsx` (4 cases including error-path).

**Types** (`src/types/index.ts`)：與 `tests/contracts/copilot-response.schema.json` 對應的 TS interfaces；用 `json-schema-to-typescript` 自動生（CI 跑檢查）。

## 8. Acceptance criteria

對應 AC-001（answer + evidence 顯示）、AC-002（runbook 5-step UI）。額外：

- AC-S004-1：UI build（`npm run build`）通過，bundle ≤ 500 KB gzipped（Sprint 1 上限）。
- AC-S004-2：`tsc --noEmit` 0 error；ESLint `--max-warnings=0`。
- AC-S004-3：禁止 `any`；錯誤型別走 `ApiError`；`console.error` 收斂於 `src/utils/logger.ts`。
- AC-S004-4：`<CopilotPanel />` 在 `INSUFFICIENT_EVIDENCE` 狀態顯示明確 banner（不是空白）。
- AC-S004-5：所有 user-facing 字串 i18n（即使僅 en）。

## 9. Test strategy

- **Unit (Vitest)**：
  - `<CopilotPanel />` 渲染 `CopilotResponse` 的三種 status（ok / INSUFFICIENT_EVIDENCE / ERROR）。
  - `<RunbookView />` 5 section 順序正確。
  - logger 模組（debug/info/warn/error）。
- **Type-check**：`tsc -b` 進 CI gate。
- **Build smoke**：`npm run build` 進 CI gate。
- **Contract sync**：JSON schema → TS interface 自動產出；CI 檢查 drift。
- **Visual / manual**：每 sprint review 走過所有 page。
- **TDD todo placeholders**：`services/digital-twin-ui/src/CopilotPanel.spec.tsx` 已備 4 個 `test.todo()`。

## 10. Demo relevance

- 整個 RunSpace 影片的核心畫面就是 UI；Copilot panel 與 runbook 是評審記得最深的兩個元素。
- VS-1 demo：90 秒影片中的 0:35–0:55 全部是 UI。
- VS-3 demo：5-step runbook 摺疊動畫是 UC2 demo 的高潮。
- VS-13 demo：CesiumJS satellite pass 提升「太空主題」直覺。

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-S004-1 | Vite 8 / TS 6 / Tailwind 4 / React 19 重大版本 plugin 不相容 | UI shell 先 build 通過再加功能；plugins 升級走 ADR |
| R-S004-2 | Bundle 超 500 KB（CesiumJS 大） | Sprint 3 evaluate code-splitting；CesiumJS lazy import |
| R-S004-3 | i18n key 漏 → 螢幕現 raw key | CI 跑 `i18next-parser` 比對 key；missing 為 error |
| R-S004-4 | 截圖 / 影片露 OS toolbar / hostname | `runspace-pitch` skill checklist 強制 |
| R-S004-5 | Copilot 回應慢 → UI 看似掛掉 | 加 loading skeleton + 30 s timeout |
