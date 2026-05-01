# AC-004 — Demo Replay

> 對應：SPEC-001/002/006/007。

## Given

- 全新 cluster（kind 或 k3d 或 docker-compose）
- 三個 sample scenario 在 `packages/scenarios/`

## When

執行 `scripts/run-demo.sh`：
1. 啟動 emulator + copilot + Prometheus + Grafana + UI
2. 載入 `beam-degradation.json`
3. 等 60s
4. 呼叫 `POST /anomaly/inject`（如 scenario 內未自動注入）
5. 呼叫 `POST /ask` "Which beam is degrading?"
6. 呼叫 `POST /runbook`
7. 把 stdout 與 evidence block 寫到 `tmp/demo-output.json`

## Then

1. `tmp/demo-output.json` 通過 `copilot-response.schema.json`。
2. AC-001 與 AC-002 之斷言皆成立。
3. Grafana dashboard 在 30 秒內呈現 SNR drop 視圖（人工確認 + screenshot 自動產出 `tmp/demo-screenshot.png` — P1 為 optional）。
4. Demo 全程 ≤ 90 秒；可錄成 90s 影片。
