# AC-001 — Beam Quality Copilot

> 對應：UC1（Beam Quality Copilot）；SPEC-001/002/003/004。

## Given

- emulator 載入 `beam-degradation.json` scenario
- 三個 beam（beam-1、beam-2、beam-3）正常運作
- t = 60s 注入 `snr_drop` anomaly 對 beam-1，magnitude 6 dB、duration 90s

## When

使用者在 Copilot 介面輸入：
> "Which beam is degrading and why?"

## Then

1. Copilot 回應 `status == "ok"`，且 `answer` 字串含 `beam-1`、`SNR`、`degrad` 三個關鍵字（不分大小寫）。
2. `evidence.metrics_used` 至少含一筆 `orbitops_beam_snr_db{beam_id="beam-1"}`，且 `value < 8`（baseline 12.5 dB - 6 dB drop = 6.5 dB ✓）。
3. `evidence.scenario_id == "beam-degradation-001"`。
4. `evidence.confidence >= 0.5`。
5. UI 在 Copilot panel 顯示 evidence block；Grafana dashboard 同步顯示 SNR drop 視圖。
6. 整體回應時間 ≤ 5 秒（mock provider）；≤ 15 秒（真實 LLM）。

## Failure modes（必須測試）

- 若 emulator 未啟動：copilot 回 `INSUFFICIENT_EVIDENCE`，不得幻想資料。
- 若 user prompt 含 jailbreak 字串：回應仍須 evidence-grounded、不暴露 system prompt。
