# 09 — Installation Research (verified versions, 2026-04-30)

> Verification commands at the end. **Always re-run `verify.sh` before installing**.

## Open-source RAN / 5GC（P2 用，第一版不接）

| Tool | Version | Released | License |
|---|---|---|---|
| srsRAN Project | release_25_10 | 2025-11-11 | AGPL-3.0 |
| OpenAirInterface 5G | v2.4.0（NTN 在分支） | 2025-12-04 | OAI Public License v1.1 |
| UERANSIM | v3.2.8 | 2026-04-15 | GPL-3.0 |
| free5GC | v4.2.2 | 2026-04-21 | Apache-2.0 |
| Open5GS | v2.7.7 | 2026-03-15 | AGPL-3.0 |

## Observability

| Tool | Version | Released |
|---|---|---|
| Prometheus | v3.11.3 | 2026-04-27 |
| Grafana | v13.0.1 | 2026-04-17 |
| Loki | v3.7.1 | 2026-03-27 |
| Tempo | v2.10.5 | 2026-04-23 |
| OpenTelemetry Collector | core v0.151.0 / stable v1.57.0 | 2026-04-28 |
| VictoriaMetrics | v1.142.0 | 2026-04-28 |
| Grafana Alloy | v1.16.0 | 2026-04-23 |

> Grafana Agent EOL Nov 2025 → use Alloy。

## Container / K8s

| Tool | Version | Released | Note |
|---|---|---|---|
| Kubernetes | v1.36.0（demo 建議 n-1 = v1.35.4） | 2026-04-22 | |
| kind | v0.31.0 | 2025-12-18 | |
| k3d | v5.8.3 | 2025-02-15 | |
| Helm | v4.1.4 | 2026-04-09 | **v3 → v4 重大版本** |
| Kustomize | kustomize/v5.8.1 | 2026-02-09 | |
| Argo CD | v3.3.8 | 2026-04-21 | |
| Flux v2 | v2.8.6 | 2026-04-21 | |
| Nephio | R5 | 2025-07-31 | K8s 1.26 ≤ v ≤ 1.32 |

## LLM / inference

| Tool / Model | Version | License |
|---|---|---|
| Ollama | v0.22.0（2026-04） | MIT |
| vLLM | v0.20.0（2026-04） | Apache-2.0 |
| llama.cpp | b8984（2026-04，rolling） | MIT |
| NVIDIA NeMo | v2.7.3（2026-04） | Apache-2.0 |
| Canary-Qwen-2.5B | shipped 2025-07-17（NeMo runtime） | CC-BY-4.0 |
| faster-whisper | v1.2.1（2025-10） | MIT |
| Whisper | v20250625 | MIT |
| Qwen3.6-27B | dense, Apache-2.0（2026-04-22） | Apache-2.0 |
| Qwen3.6-35B-A3B | MoE, Apache-2.0（2026-04-16） | Apache-2.0 |
| Llama 4 Scout/Maverick | 2025-04-05 | Llama 4 Community License |
| Gemma 4 | 2026-04-02 | Apache-2.0 |
| Kimi K2.6 | 2026-04-20 | Modified MIT |
| Sionna | v2.0.1（2026-04-01） | Apache-2.0 |
| Sionna RT | v2.0.1（2026-04-01；獨立包） | Apache-2.0 |

## Frontend / 3D

| Tool | Version | Released | Note |
|---|---|---|---|
| CesiumJS | 1.140 | 2026-04-01 | |
| Three.js | r184 | 2026-04-16 | |
| React | v19.2.5 | 2026-04-08 | |
| Vite | v8.0.10 | 2026-04-23 | **v7 → v8 重大版本** |
| TypeScript | v6.0.3 | 2026-04-16 | **v5 → v6 重大版本（Go 編譯器）** |
| Tailwind CSS | v4.2.4 | 2026-04-21 | **v3 → v4 重大版本** |

## Backend (Python)

| Tool | Version | License |
|---|---|---|
| Python | 3.13.13（建議） / 3.14.4（最新） | PSF |
| FastAPI | 0.136.1（2026-04-23） | MIT |
| Pydantic | 2.13.3（2026-04-20） | MIT |
| uvicorn | 0.46.0（2026-04-23） | BSD-3 |
| prometheus-client | v0.25.0（2026-04-09） | Apache-2.0 |
| httpx | 0.28.1（2024-12-06）— **16 個月未發版，注意** | BSD-3 |
| pytest | 9.0.3（2026-04-07） | MIT |
| ruff | 0.15.12（2026-04-24） | MIT |

## 重大 breaking changes（2024 後）

- Helm 3 → 4：chart hook lifecycle 改、OCI 預設。
- TypeScript 5 → 6：原生 Go compiler `tsgo`。
- Vite 5/6/7 → 8：plugin API 變動。
- Tailwind 3 → 4：Oxide 引擎、CSS-first config。
- Grafana Agent → Alloy。
- OpenTelemetry Collector：dual versioning（stable 1.x、beta 0.x）。
- Sionna 拆出 sionna-rt 為獨立包。
- Gemma 4 改 Apache-2.0（Gemma 3 為自訂授權）。
- Qwen3.6-Max 為閉源；OSS 為 Qwen3.6-27B 與 35B-A3B。
- Llama 4 Behemoth 仍未發布；Scout/Maverick 為當前 OSS-tier。

## P0 建議 pin set

```
Python 3.13.13 + FastAPI 0.136.1 + Pydantic 2.13.3 + uvicorn 0.46.0 + prometheus-client 0.25.0 + httpx 0.28.1 + pytest 9.0.3 + ruff 0.15.12
React 19.2.5 + Vite 8.0.10 + TypeScript 6.0.3 + Tailwind 4.2.4 + CesiumJS 1.140
Prometheus 3.11.3 + Grafana 13.0.1
Kubernetes 1.35.4 + kind 0.31.0 + Helm 4.1.4 + Kustomize 5.8.1 + Argo CD 3.3.8
Ollama 0.22.0 + Qwen3.6-27B
faster-whisper 1.2.1（P1 voice）
```

## 安裝前驗證指令

```bash
# 大批 GitHub releases
for r in srsran/srsRAN_Project aligungr/UERANSIM free5gc/free5gc open5gs/open5gs \
         prometheus/prometheus grafana/grafana grafana/loki grafana/tempo \
         open-telemetry/opentelemetry-collector grafana/alloy \
         kubernetes/kubernetes kubernetes-sigs/kind k3d-io/k3d helm/helm \
         kubernetes-sigs/kustomize argoproj/argo-cd fluxcd/flux2 \
         ollama/ollama vllm-project/vllm ggml-org/llama.cpp NVIDIA/NeMo \
         SYSTRAN/faster-whisper NVlabs/sionna NVlabs/sionna-rt \
         CesiumGS/cesium mrdoob/three.js facebook/react vitejs/vite \
         microsoft/TypeScript tailwindlabs/tailwindcss \
         fastapi/fastapi pydantic/pydantic encode/uvicorn \
         prometheus/client_python encode/httpx pytest-dev/pytest astral-sh/ruff; do
  gh api "repos/$r/releases/latest" --jq '"\(.full_name // "'"$r"'")\t\(.tag_name)\t\(.published_at)"'
done

# OAI（GitLab）
curl -s 'https://gitlab.eurecom.fr/api/v4/projects/oai%2Fopenairinterface5g/releases?per_page=3' \
  | jq -r '.[]|"\(.tag_name)\t\(.released_at)"'

# Nephio R5 catalog tags
git ls-remote --tags https://github.com/nephio-project/catalog | tail

# AODT 開源（公告 2026-03 上線；確認）
gh search repos "aerial omniverse digital twin" --owner NVIDIA --owner NVlabs

# Sionna RT 最新
pip index versions sionna-rt

# HF model 存在性
for m in Qwen/Qwen3.6-27B Qwen/Qwen3.6-35B-A3B moonshotai/Kimi-K2.6 google/gemma-4 nvidia/canary-qwen-2.5b; do
  curl -sI "https://huggingface.co/$m" | head -1
done
```

**仍須安裝前確認**：AODT 公開 repo URL、AODT 最低 GPU 等級、Rel-19 NTN regenerative 確切 TS 文號、Vireo Ka beam 數、O-RAN O2 IMS spec 版號、CesiumAstro 合約是否 1A only、1A 發射載具、Nephio R6 GA、Sionna RT 後續版本。
