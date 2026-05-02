# SPEC-001 — scenario-generator

| Field | Value |
|---|---|
| Status | Accepted (Sprint 1 — substantively shipped 2026-05-02; schema v2 per ADR-007) |
| Owner | ran-ntn-engineer |
| Sprint | 1 (VS-1, VS-3, VS-5) |
| Depends on | SPEC-000 |
| Related ACs | AC-004 (primary); AC-001/AC-002 (consumes scenarios) |
| Schema version | v2 (flat top-level: `start_time` / `duration_seconds` / `satellite_id` / `ground_station_id` / `events[]` / `expected_anomaly` — replaces v1's `pass_window` / nested `satellite.id` / `anomaly_injection[]` / `expected_runbook_keywords[]`) |

## 1. User story

> 作為 NTN ground-station 整合測試工程師，我想要在不依賴真衛星的情況下，**載入一個 scenario JSON**（描述 satellite pass、beam、anomaly），讓 emulator 重播後產生可預測的 metrics 變化，**這樣我就能** 對 Copilot / dashboard / runbook 做端到端驗證。

## 2. Problem

`ntn-metrics-emulator` 與所有 golden replay 測試都需要一個明確、版本化、可被多重消費的 scenario 真值來源。沒有這個來源，測試會散落在每個服務的 fixture，難以維護；指標、用語、anomaly 注入邏輯也無法跨團隊一致。

## 3. Scope

- 純函式 + CLI generator：`generate(template_name) -> dict`，輸出符合 `scenario.schema.json`。
- 三個內建 template：`beam-degradation`、`handover-failure`、`gateway-fallback`。
- 寫檔到 `packages/scenarios/<scenario_id>.json`。
- Naming align 3GPP Rel-19（`payload_mode ∈ {transparent, regenerative}`）。

## 4. Non-scope

- 不模擬真實衛星軌跡傳播（Skyfield/SGP4 留 P2）。
- 不產 RF channel coefficients（Sionna RT 留 P2）。
- 不暴露 HTTP API（P1 才考慮 `POST /scenarios/generate`）。
- 不接真 TLE / TASA 公開資料（用 stub TLE 即可）。

## 5. Inputs

- Template 名（`str`，從內建清單）。
- 可選 overrides：`pass_window_start_utc`、`anomaly_t_offset_s`、`anomaly_magnitude_db`（Sprint 2+ 開放）。

## 6. Outputs

- 一份 dict（記憶體中）符合 `tests/contracts/scenario.schema.json` v2。
- 若以 CLI 呼叫，落盤至指定路徑；預設檔名 = `<scenario_id>.json`。
- stdout：scenario_id、檔案路徑、validation status。

頂層必填欄位（v2）：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `scenario_id` | string | 例：`beam-degradation-001`；通過 `^[a-z0-9-]{3,64}$` |
| `start_time` | ISO 8601 datetime | UTC，例 `2026-04-30T12:00:00Z` |
| `duration_seconds` | integer > 0 | pass window 總長 |
| `satellite_id` | string | 例 `b5g-1a` |
| `ground_station_id` | string | 例 `gs-tw-01` |
| `beams[]` | array of `{beam_id, boresight_az_deg?, boresight_el_deg?, hpbw_deg?}` | ≥ 1 |
| `events[]` | array of `{t_offset_seconds, type, target, duration_seconds, magnitude_db?, magnitude_hz?}` | event type 屬於 schema enum |
| `expected_anomaly` | `{type, target, keywords[]}` | 給 Copilot grounding 用 |

`events[].type` enum：`snr_drop` | `handover_failure` | `doppler_spike` | `gateway_outage` | `packet_loss_spike`。

## 7. API or file contracts

**JSON Schema**：`tests/contracts/scenario.schema.json` v2（單一真相；任何欄位變動須先 PR 修改 schema）。

**Python API**：

```python
def generate(
    scenario: str,
    *,
    seed: int = 42,
) -> dict: ...

def list_scenarios() -> list[str]: ...

def write_to(scenario: dict, path: str | Path) -> Path: ...
```

`generate(scenario, seed)` 回傳通過 schema 的 dict；同 (scenario, seed) 對 → 完全相同 dict（deterministic）。未知 scenario 拋 `ValueError`。

**CLI**：

```bash
python -m scenario_generator generate \
  --scenario beam-degradation \
  --seed 42 \
  [--out packages/scenarios/beam-degradation.json]
```

預設 seed = 42；預設 `--out` = `packages/scenarios/<scenario_id>.json`。返回碼：`0` 成功、`1` schema 驗證失敗、`2` 未知 scenario。

**HTTP**（P1，先預留）：
- `POST /scenarios/generate` body: `{"scenario": "...", "seed": 42}` → 200 + scenario JSON。

## 8. Acceptance criteria

對應 `docs/acceptance/AC-004-demo-replay.md`。本 SPEC 額外要求：

- AC-S001-1：`generate("beam-degradation")` 回傳 dict 通過 `scenario.schema.json` 驗證。
- AC-S001-2：`scenario_id` 以 template 名稱開頭（如 `beam-degradation-001`）。
- AC-S001-3：相同 template + 相同 seed → 完全相同 dict（deterministic）。
- AC-S001-4：未知 template 拋 `ValueError`，CLI exit 2。
- AC-S001-5：`anomaly_injection[*].type` 必落於 schema enum；違反者 schema 驗證會擋。

## 9. Test strategy

- **Unit**：`pytest services/scenario-generator/tests/`
  - `test_generate_from_template_writes_valid_scenario_json`（已在 `test_spec_001_red.py` 為 xfail-strict）
  - `test_list_templates_contains_three_known_scenarios`（smoke）
  - `test_unknown_template_raises`
  - `test_deterministic_with_same_seed`
- **Contract**：scenario JSON 用 `jsonschema` 驗 `scenario.schema.json`；於 `verify.sh` gate 4 全跑。
- **Golden**：3 個 sample scenario 已 commit；CI replay 後比對 `tests/golden/*.expected.json`。
- **Integration**：emulator 載入後 tick 一輪，metrics 出現預期 anomaly（VS-1 / VS-2）。
- **TDD red commit**：`services/scenario-generator/tests/test_spec_001_red.py`。

## 10. Demo relevance

- **VS-1（mock e2e）**：使用者啟動後預設載入 `beam-degradation` scenario；Copilot 回答 evidence 出現 `scenario_id="beam-degradation-001"`。
- **VS-3（runbook）**：handover-failure / gateway-fallback 兩 scenario 為 UC2 demo 來源。
- **VS-5（demo replay）**：`scripts/run-demo.sh` 切換 scenario 即可重播不同 demo 章節。

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-S001-1 | scenario 命名 / 用語與 3GPP Rel-19 漂移 | ran-ntn-engineer 校對；引用 `docs/00_research_2026_04.md` §2.5 Rel-19 |
| R-S001-2 | schema 變動 → 既有 golden 失效 | schema bump 必同 PR 更新所有 sample / golden；CI gate 4 阻擋 |
| R-S001-3 | seed 為 `None` 時呼叫 `random.random` 造成測試不穩 | 預設 seed = 0；明確要求 callers 在測試傳 seed |
| R-S001-4 | overrides API 增加複雜度 | Sprint 1 不開 overrides；最小可用面 |
| R-S001-5 | 未來接 P2 Skyfield 時 schema migrate cost | schema `version` 欄位已存在；migration 走 ADR |
