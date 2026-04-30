你是一位「資深學術研究員 + Staff 級雲原生電信系統架構師 + AI-RAN/NTN 研發工程師 + Claude Code 專案骨架設計專家」。

你的任務是：根據 2026 年 04 月最新公開資訊，為一個 RunSpace Innovation Challenge 參賽專案設計「突破性」但可落地的開發方案，並產出一個完整專案骨架壓縮檔。

專案名稱：
OrbitOps Copilot: A Cloud-Native Operations Twin for B5G LEO Ground Stations

中文名稱：
軌道運維副駕：B5G 低軌地面站的雲原生運維數位孿生與 AI 決策支援

核心概念：
以 Kubernetes + Nephio/GitOps 建立 B5G/NTN 低軌地面站運維訓練與整合測試 sandbox，結合 Omniverse/AODT-style digital twin、RAN/NTN metrics emulator、Prometheus/Grafana 與 LLM Copilot，展示 beam quality anomaly、handover/fallback event、Doppler/latency/SNR 異常解釋與 runbook generation。

請你務必上網查找 2026 年 04 月可得的最新公開資訊，並優先查以下官方或高品質來源：
1. TASA Beyond 5G LEO Satellite Program 官方資料；
2. CesiumAstro 與 TASA 2025/04 B5G 合約；
3. YTTEK 2026/01 加入 TASA B5G LEO 計畫的官方/新聞資料；
4. 3GPP Release 19 NTN regenerative payload、Release 20 roadmap；
5. Nephio R5 / O-RAN O2 IMS / FOCOM / OAI Core and RAN testbed 官方文件；
6. NVIDIA Aerial、Aerial Omniverse Digital Twin、AI Aerial、Sionna / Sionna RT；
7. srsRAN、OpenAirInterface、UERANSIM、free5GC、Open5GS 等可用於 RAN/NTN-style emulator 的開源專案；
8. Prometheus、Grafana、OpenTelemetry、Loki、Tempo、VictoriaMetrics 等 observability stack；
9. LLM ops / local inference 方案：vLLM、Ollama、llama.cpp、NVIDIA NeMo / Canary-Qwen、Whisper/faster-whisper、Qwen、Llama、Gemma、Kimi 等；
10. Claude Code 官方文件：best practices、CLAUDE.md/memory、subagents、hooks、settings.json、skills、slash commands、MCP、GitHub Actions。

注意：
- 不要憑印象寫版本號。所有版本號、安裝指令、repo URL、Helm chart、container image、模型名稱、API、CRD 名稱都必須先查證。
- 若無法確認最新版本，請在文件中標示「需安裝前再次確認」，並提供查證指令。
- 不要把 Isaac Sim 說成真正的 RAN ray-tracing 核心。請區分：
  - AODT / Sionna RT / ray tracing：無線與 beam/channel 模擬概念；
  - Isaac Sim / Omniverse：3D 場景與數位孿生視覺層；
  - CesiumJS / Three.js：web-based satellite pass、地面站、beam coverage 視覺化。
- 不要承諾真 Ka-band beam steering、真 SDR OTA、真 OAI/srsRAN NTN full stack。第一版 MVP 必須可在 7–14 天內完成。
- 第一版只做「metrics emulator + digital twin UI + LLM copilot + K8s deployment」。
- 專案不能在提交文件中暴露團隊名稱、學校、個人姓名、Logo 或可識別資訊，因為 RunSpace 有匿名化規定。

請分三大階段完成工作。

====================
Phase 1：深入調研與技術路線報告
====================

請產出 `docs/00_research_2026_04.md`，內容包含：

1. Executive Summary
   - 用 5–8 點說明 OrbitOps Copilot 為何是 RunSpace 高潛力題目。
   - 明確說明它不是泛 AI chatbot，也不是普通 Grafana dashboard，而是 B5G/NTN 地面站 operations twin。

2. 2026 最新趨勢查核
   - TASA B5G LEO 計畫；
   - CesiumAstro / TASA 1A；
   - YTTEK / TASA 1B；
   - 3GPP Rel-19 NTN regenerative payload；
   - 3GPP Rel-20 roadmap；
   - NVIDIA Aerial / AODT / AI-RAN；
   - Nephio R5 / O-RAN O2 IMS / FOCOM；
   - open-source RAN/5GC/observability/LLM stack。
   每一項都要附來源、日期、可信度、以及對本專案的影響。

3. 競品與替代方案分析
   至少比較：
   - AWS Ground Station；
   - Azure Orbital；
   - SatNOGS；
   - Open Cosmos / CGI Insula-like ground segment；
   - NVIDIA AODT；
   - 傳統地面站訓練/測試工具；
   - 一般 observability platform。
   請說明 OrbitOps Copilot 的差異化：
   - B5G/NTN domain workflow；
   - cloud-native deployable sandbox；
   - beam/handover/anomaly operations twin；
   - LLM explanation + runbook；
   - 可作為教育訓練、整合測試、pre-field validation 工具。

4. 技術可行性分析
   請將功能分成：
   - P0：7 天內必做；
   - P1：14–30 天可做；
   - P2：決賽或長期研究；
   - 不做：第一版不碰的高風險項目。

5. RunSpace 評分對齊
   請用官方 Innovation Category 30/30/30/10 評估：
   - Relevance to Space；
   - Problem Solving；
   - Future Impact；
   - Business Feasibility。
   也請附上若採用 35/25/20/20 實作組標準時的對照評分。

====================
Phase 2：突破性產品設計與系統架構
====================

請產出以下文件：

`docs/01_product_strategy.md`
內容包含：
- Problem statement；
- Target users；
- Jobs-to-be-done；
- 2 個核心 use case；
- 不做的功能；
- MVP 定義；
- Demo story；
- 90 秒影片腳本；
- 3 分鐘英文字幕影片腳本；
- 10 頁英文 RunSpace 初審簡報大綱。

核心 use case 僅限兩個：

Use Case 1：Beam Quality Copilot
- 系統模擬 LEO satellite pass、ground station、3 個 candidate beam；
- 指標包含 SNR/SINR、latency、packet loss、Doppler residual、elevation angle、handover timer；
- 使用者可用文字或語音詢問：「Which beam is degrading and why?」
- Copilot 需以 metrics + logs 解釋 beam degradation，並提供操作建議。

Use Case 2：Handover / Fallback Anomaly Explanation
- 系統模擬 handover failure、gateway failover、Doppler compensation warning；
- Kubernetes pod / service / config profile 的狀態要能被觀察；
- Copilot 產生 runbook：
  1. What happened?
  2. Why it matters?
  3. Recommended action.
  4. Risk if ignored.
  5. Next observation window or fallback profile.

`docs/02_architecture.md`
內容包含：
- Mermaid 架構圖；
- Sequence diagram；
- Data flow；
- Component boundaries；
- Security boundary；
- LLM boundary；
- Simulation vs real integration boundary；
- 如何未來接 SDR-in-the-loop、OAI/srsRAN、Nephio O2 IMS、AODT/Sionna RT。

建議架構：

[scenario-generator]
  產生 satellite pass、beam profile、handover event、anomaly injection。

[ntn-metrics-emulator]
  產生 SNR、SINR、latency、packet loss、Doppler residual、beam_id、handover_state、gateway_id、pod_health。

[metrics-exporter]
  暴露 Prometheus metrics。

[prometheus + grafana]
  收集與展示 metrics。

[digital-twin-ui]
  用 CesiumJS 或 Three.js 顯示衛星、地面站、beam、handover、異常事件。

[copilot-api]
  FastAPI 或 Node.js API，從 Prometheus/Loki/mock logs 取資料，呼叫 LLM 產生 anomaly explanation 與 runbook。

[voice-interface optional]
  faster-whisper / Whisper / Canary-Qwen ASR，把語音轉文字。

[k8s manifests / helm]
  讓整套 demo 可以部署到 local kind/k3d/minikube 或遠端 Kubernetes。

`docs/03_breakthrough_directions.md`
請提出 5 個「突破性但分階段可落地」的開發方向：
1. NTN operations twin；
2. AI-RAN beam/handover copilot；
3. GitOps/Nephio intent-to-sandbox deployment；
4. Closed-loop anomaly explanation and rollback recommendation；
5. Future SDR-in-the-loop / AODT/Sionna RT integration。

每個方向都要包含：
- 技術背景；
- 為何是 2026 前沿；
- 開源工具；
- 實作路線；
- MVP；
- 風險；
- 驗證方式；
- RunSpace 簡報亮點。

`docs/04_technical_decisions.md`
用 ADR 格式記錄技術選型：
- 為什麼第一版用 metrics emulator 而不直接上 OAI/srsRAN NTN full stack；
- 為什麼第一版用 CesiumJS/Three.js 而不是完整 Isaac Sim；
- 為什麼用 Prometheus/Grafana；
- 為什麼 LLM copilot 要 RAG over metrics/logs，不可自由幻想；
- 為什麼 Nephio 第一版只做 GitOps package stub，而不是完整 O2 IMS lifecycle。

`docs/05_validation_plan.md`
定義測試與驗證：
- Unit tests；
- API tests；
- Simulation golden scenarios；
- Demo replay tests；
- Metrics correctness tests；
- LLM output grounding tests；
- Kubernetes deployment smoke tests；
- Security checks；
- Anonymous submission checklist。

====================
Phase 3：產出完整專案骨架與壓縮檔
====================

請建立一個 repo 骨架，資料夾名稱：
`orbitops-copilot/`

專案必須包含：

1. 根目錄文件
- `README.md`
- `CLAUDE.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `Makefile`
- `verify.sh`
- `test.sh`
- `.env.example`
- `.gitignore`
- `PROJECT_STATUS.md`

2. Claude Code 專用資料夾
- `.claude/settings.json`
- `.claude/commands/research.md`
- `.claude/commands/plan.md`
- `.claude/commands/implement.md`
- `.claude/commands/test.md`
- `.claude/commands/review.md`
- `.claude/commands/demo.md`
- `.claude/agents/researcher.md`
- `.claude/agents/architect.md`
- `.claude/agents/k8s-platform-engineer.md`
- `.claude/agents/ran-ntn-engineer.md`
- `.claude/agents/observability-engineer.md`
- `.claude/agents/llm-copilot-engineer.md`
- `.claude/agents/security-reviewer.md`
- `.claude/skills/orbitops-research/SKILL.md`
- `.claude/skills/k8s-demo/SKILL.md`
- `.claude/skills/runspace-pitch/SKILL.md`

CLAUDE.md 必須包含：
- Project mission；
- Non-negotiable constraints；
- Architecture principles；
- Coding rules；
- Testing rules；
- Security and privacy rules；
- Anonymous competition submission rules；
- Commands；
- Current MVP scope；
- Forbidden scope；
- Definition of done。

AGENTS.md 必須說明每個 agent 的角色、輸入、輸出、不可做的事、交付標準。

`.claude/settings.json` 請採安全保守設定，不要預設允許危險 shell 命令。可以設定 hooks，但 hooks 必須只做格式檢查、測試、lint、禁止提交秘密資訊，不能自動刪檔或上傳資料。

3. docs/
- `docs/00_research_2026_04.md`
- `docs/01_product_strategy.md`
- `docs/02_architecture.md`
- `docs/03_breakthrough_directions.md`
- `docs/04_technical_decisions.md`
- `docs/05_validation_plan.md`
- `docs/06_runspace_pitch_outline.md`
- `docs/07_demo_script_90s.md`
- `docs/08_demo_script_3min.md`
- `docs/09_installation_research.md`
- `docs/10_links.md`

4. services/
請建立可逐步實作的服務骨架：

- `services/scenario-generator/`
  - Python package
  - 產生 satellite pass / beam / anomaly scenario JSON
  - 提供 sample scenarios

- `services/ntn-metrics-emulator/`
  - Python FastAPI 或 Go service
  - 暴露 Prometheus metrics endpoint `/metrics`
  - 可注入 anomaly

- `services/copilot-api/`
  - FastAPI 或 Node.js
  - 提供 `/ask`, `/explain`, `/runbook`, `/healthz`
  - 先用 mock LLM provider interface，保留 Ollama/vLLM/OpenAI-compatible endpoint adapter
  - 嚴格要求回答必須引用 metrics/log evidence，不可憑空回答

- `services/digital-twin-ui/`
  - React + Vite + TypeScript
  - CesiumJS 或 Three.js 擇一
  - 顯示 satellite pass、ground station、beam、handover state、anomaly banner、copilot panel

- `services/voice-interface/`
  - optional
  - 提供 faster-whisper / local ASR 的接口 stub

5. deploy/
- `deploy/k8s/base/`
- `deploy/k8s/overlays/local/`
- `deploy/helm/orbitops-copilot/`
- `deploy/docker-compose.yml`
- `deploy/kind/cluster.yaml`
- `deploy/k3d/cluster.yaml`

6. observability/
- `observability/prometheus/prometheus.yml`
- `observability/grafana/dashboards/orbitops-overview.json`
- `observability/grafana/provisioning/`
- `observability/loki/` optional

7. packages/
- `packages/scenarios/beam-degradation.json`
- `packages/scenarios/handover-failure.json`
- `packages/scenarios/gateway-fallback.json`
- `packages/nephio-stubs/README.md`
- `packages/nephio-stubs/orbitops-groundstation-package/`

8. tests/
- unit tests
- integration tests
- golden scenario tests
- k8s smoke tests

9. scripts/
- `scripts/bootstrap.sh`
- `scripts/install-deps.sh`
- `scripts/dev-up.sh`
- `scripts/dev-down.sh`
- `scripts/run-demo.sh`
- `scripts/generate-scenarios.py`
- `scripts/check-no-secrets.sh`
- `scripts/package-zip.sh`

10. GitHub Actions
- `.github/workflows/ci.yml`
  - lint
  - unit tests
  - typecheck
  - build
  - docker build dry-run
  - k8s manifest validation
  - no-secrets check

11. 最後請產生：
- `orbitops-copilot.zip`
- 其中必須包含完整 repo 骨架、docs、scripts、Claude Code config、agents、skills、commands。
- 請列出壓縮檔內的檔案樹。
- 請提供安裝與啟動指令。
- 請提供下一步給 Claude Code 的 5 個任務 prompt。

====================
技術實作要求
====================

請優先用這種可快速落地的 stack：

Frontend:
- React + Vite + TypeScript
- Tailwind
- CesiumJS 或 Three.js
- Recharts 或 lightweight charting

Backend:
- Python 3.11+ / 3.12+
- FastAPI
- Pydantic
- Prometheus client
- httpx
- pytest
- ruff
- mypy optional

LLM:
- 先用 OpenAI-compatible local endpoint adapter
- 支援 Ollama / vLLM / LM Studio / remote OpenAI-compatible endpoint
- 不要硬綁單一 commercial API
- LLM output 必須有 evidence block，例如：
  - metrics used
  - logs used
  - scenario ID
  - timestamp
  - confidence

Kubernetes:
- local: kind 或 k3d
- manifests: kustomize
- optional: Helm chart
- observability: Prometheus + Grafana
- Nephio: first version only stubs / package-style docs，勿假裝完整 O2 IMS integration 已完成

Security:
- 不要 commit secrets
- `.env.example` only
- check-no-secrets script
- LLM prompt injection note
- MCP security note
- no destructive hooks

Testing:
- `make test`
- `make verify`
- `./verify.sh`
- `./test.sh`
- Every generated service must have at least minimal test coverage.

====================
輸出格式要求
====================

請用繁體中文撰寫研究與策略文件；程式碼註解可用英文。README 可中英混合。

請最終輸出：
1. 研究摘要；
2. 已建立的檔案樹；
3. 每個重要文件的摘要；
4. 安裝方式；
5. Demo 啟動方式；
6. 測試方式；
7. 壓縮檔連結或路徑；
8. 下一步開發任務列表。

請務必：
- 對每個外部事實加上來源；
- 不要捏造版本；
- 不要過度承諾真 NTN full stack；
- 不要把視覺化 demo 說成已接真 Ka-band/RF；
- 不要在匿名競賽文件中露出團隊、學校、姓名、Logo 或任何可識別資訊；
- 所有設計都要能在 7–14 天內做出 P0 demo。