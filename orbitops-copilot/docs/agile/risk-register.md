# Risk Register

> 持續更新；每個 sprint review 必檢視。Score = Likelihood × Impact（1-5 each；max 25）。

| ID | Risk | L | I | Score | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-01 | LLM 幻想／越獄／未引用 evidence | 4 | 5 | 20 | 強制 evidence schema、grounding test、injection test、temperature ≤ 0.3、JSON-mode | llm-copilot-engineer | Open |
| R-02 | 評審期待真 RF/SDR 整合 | 3 | 4 | 12 | 投影片明示 P0 範圍；P2 路線寫明 Sionna RT/AODT/真 RAN | architect | Open |
| R-03 | 匿名性外洩（commit author / metadata / UI 截圖） | 3 | 5 | 15 | check-no-secrets.sh + exiftool + CI 阻擋 + PR review | security-reviewer | Open |
| R-04 | 版本漂移（Helm 4 / Vite 8 / TS 6 / Tailwind 4 重大版本踩雷） | 4 | 3 | 12 | verify.sh 每次 install 前比對；docs/09 列 breaking change | k8s-platform-engineer | Open |
| R-05 | AODT OSS 釋出延期（公告 2026-03） | 3 | 2 | 6 | 列為 P2，不擋 MVP | researcher | Open |
| R-06 | scenario 與 3GPP Rel-19 用詞漂移 | 2 | 4 | 8 | ran-ntn-engineer 校對；docs 引用 Ericsson NTN payload blog | ran-ntn-engineer | Open |
| R-07 | docker-compose ≠ K8s 行為差異 | 3 | 3 | 9 | CI 跑 manifest validation；kind smoke test | k8s-platform-engineer | Open |
| R-08 | 真 LLM endpoint 在評審現場斷線 | 3 | 4 | 12 | mock provider 永遠可用作 fallback；demo 影片預錄 | llm-copilot-engineer | Open |
| R-09 | 7-14 天時間爆預算 | 3 | 5 | 15 | vertical slice 1-2 天；Sprint 1 嚴格守 P0 範圍 | architect | Open |
| R-10 | RunSpace 評分標準變動 | 2 | 3 | 6 | 兩套權重（30/30/30/10、35/25/20/20）皆有自評 | architect | Open |
| R-11 | open-source 授權衝突（AGPL: srsRAN/Open5GS/Grafana/Loki/Tempo） | 2 | 3 | 6 | 不發行 SaaS；docs/10 列各依賴授權 | security-reviewer | Open |
| R-12 | hooks 誤刪檔 / 自動 push | 2 | 5 | 10 | settings.json 安全保守；CI 審 hook diff；禁止 rm/curl/git push hooks | security-reviewer | Mitigated |

## 退出條件

每個 risk 的 Score 降至 ≤ 6 或 status 標記 `Closed/Mitigated`。
