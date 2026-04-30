# 03 — MCP Install Plan

> Sprint 0 「Must install now」清單**為空**——這是有意識的決策（見 `04_mcp_decision_record.md`）。
> 本檔提供 **Sprint 1+ 起逐步安裝**的具體步驟，作為日後執行參考。
>
> **使用者尚未授權安裝；本檔僅為 plan，不啟動。**
>
> 撰寫日期：2026-04-30。所有版本 / 指令於該日查證；標 **verify before install** 者請以該指令再核。

---

## 通用前置

每次安裝任何 MCP 前皆執行：

```bash
./verify.sh                                                  # 6 gate 全綠才開始
scripts/check-no-secrets.sh                                  # 確認 working tree 清潔
git status                                                   # 確認無未 commit 變更
```

`.mcp.json` 變更必走 PR + 兩人 review；commit message `[mcp] add <server>` 開頭。

token 注入策略：
- 開發機：`direnv` + `.envrc`（`.envrc` 入 `.gitignore`，由各人自行建立）
- 或：1Password CLI `op://` 引用
- 或：OS keyring（`secret-tool`、`security`）

CI：**不啟用 MCP**；CI workflow 中的 `gh api` 仍用 GitHub Actions 自帶 `GITHUB_TOKEN`，**與 MCP 路徑無關**。

---

## P1.1 — github/github-mcp-server（Sprint 1 起）

### 安裝前檢查

```bash
# 1. 確認最新 release tag
gh release view --repo github/github-mcp-server --json tagName,publishedAt

# 2. 為本 repo 建 fine-grained PAT
#    https://github.com/settings/personal-access-tokens
#    Repository access: only this repo (orbitops-copilot fork)
#    Permissions: Contents R, Pull requests R, Metadata R, Issues R
#    Expiration: 30 day（短期；定期續發）

# 3. 確認 docker 可用（隔離 host blast radius）
docker --version
```

### 安裝指令

**不執行；以下僅供 Sprint 1 啟用時參考。**

加入 project `.mcp.json`（建立此檔；確認在 .gitignore 之外、會 commit）：

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server:<PIN>",
        "--read-only",
        "--toolsets", "context,issues,pull_requests,repos"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

`<PIN>` 由 `gh release view` 取得；不可用 `:latest`。

### 設定範例

於 `.claude/settings.json` `permissions.allow` 顯式列舉所需工具（**不用 wildcard**）：

```jsonc
{
  "permissions": {
    "allow": [
      "mcp__github__get_pull_request",
      "mcp__github__get_pull_request_diff",
      "mcp__github__list_pull_request_files",
      "mcp__github__get_pull_request_comments",
      "mcp__github__list_issues",
      "mcp__github__get_issue",
      "mcp__github__search_repositories"
    ],
    "deny": [
      "mcp__github__create_*",
      "mcp__github__update_*",
      "mcp__github__delete_*",
      "mcp__github__merge_*"
    ]
  }
}
```

### 權限限制

- PAT 必為 **fine-grained**，scope 至本 repo + 最小 R 權限
- `--read-only` flag **必開**；解除需 ADR
- 啟用後 30 天內必旋轉 PAT

### 測試方式

```bash
# 1. 在 Claude Code 中 prompt：「Show me the diff of PR #1」
#    應觸發 mcp__github__get_pull_request_diff，被允許
# 2. prompt：「Comment on PR #1」
#    應被 deny（mcp__github__create_issue_comment 不在 allow，且 --read-only）
# 3. 退出 Claude Code，重新進入：應再次出現 per-project consent dialog
```

### 移除方式

```bash
claude mcp remove github
claude mcp reset-project-choices
# 從 .mcp.json 刪該段；commit；revoke PAT 於 GitHub
```

### 安全注意事項

- PAT 千萬不可 commit；`scripts/check-no-secrets.sh` 已 catch `gh[pousr]_[A-Za-z0-9]{30,}`
- 若 issue / PR body 含可疑指令（prompt injection），仍須由 LLM 上層 evidence schema 守住
- Sprint 2 評估是否解 `--read-only` 給 `/release` 自動發 release notes

---

## P1.2 — containers/kubernetes-mcp-server（Sprint 1 起）

### 安裝前檢查

```bash
# 1. 確認最新 release
gh release view --repo containers/kubernetes-mcp-server --json tagName,publishedAt

# 2. 建專屬 ServiceAccount
kubectl create namespace orbitops || true
kubectl -n orbitops create serviceaccount orbitops-mcp-viewer
kubectl create clusterrolebinding orbitops-mcp-viewer-binding \
  --clusterrole=view --serviceaccount=orbitops:orbitops-mcp-viewer

# 3. 取 SA token，輸出獨立 kubeconfig
TOKEN=$(kubectl -n orbitops create token orbitops-mcp-viewer --duration=24h)
# 寫到 ~/.kube/orbitops-mcp.kubeconfig（手動編輯）
```

### 安裝指令（Sprint 1）

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": [
        "-y", "kubernetes-mcp-server@<PIN>",
        "--read-only",
        "--toolsets", "core,config,helm",
        "--kubeconfig", "${ORBITOPS_KUBECONFIG}"
      ],
      "env": {
        "ORBITOPS_KUBECONFIG": "${HOME}/.kube/orbitops-mcp.kubeconfig"
      }
    }
  }
}
```

### 權限限制

- ServiceAccount 綁 `view` ClusterRole（read-only）
- `--read-only` flag 阻 create/update/delete
- 工具集只啟 `core,config,helm`（去 tekton/kiali/kubevirt/kcp）

### 測試方式

```bash
# 1. prompt：「List pods in orbitops namespace」→ 允許
# 2. prompt：「Delete pod xxx」→ deny（--read-only + ClusterRole view）
```

### 移除方式

```bash
claude mcp remove kubernetes
kubectl delete clusterrolebinding orbitops-mcp-viewer-binding
kubectl -n orbitops delete sa orbitops-mcp-viewer
rm ~/.kube/orbitops-mcp.kubeconfig
```

### 安全注意事項

- 不要把個人 admin kubeconfig 餵給 MCP；用專屬 SA
- SA token 24h 過期；若改長期 token，旋轉週期 ≤ 7 天
- kind/k3d local cluster 即使被 compromise 影響有限；**正式 cluster 永不接 MCP** 直到 PR 兩人核可

---

## P1.3 — grafana/mcp-grafana（Sprint 1 obs 上線時）

### 安裝前檢查

```bash
docker pull mcp/grafana   # verify image exists
# Grafana 中建 Service Account：role=Viewer；發 token；scope 限 OrbitOps folder
```

### 安裝指令

```json
{
  "mcpServers": {
    "grafana": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GRAFANA_URL", "-e", "GRAFANA_API_KEY",
        "mcp/grafana"
      ],
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_API_KEY": "${GRAFANA_VIEWER_TOKEN}"
      }
    }
  }
}
```

### 權限限制 / 測試 / 移除：同 P1.1 / P1.2 模式

### 安全注意事項

- SA role 必為 **Viewer**，不開 Editor / Admin
- 若用遠端 Grafana，URL 必走 TLS 並做 SSRF 審視（內網 vs 外網）

---

## P1.4 — pab1it0/prometheus-mcp-server（optional, P1）

僅當 Grafana MCP 不夠用（如需直接 PromQL 不走 datasource proxy）才裝。

```json
{
  "mcpServers": {
    "prometheus": {
      "command": "docker",
      "args": ["run","-i","--rm","-e","PROMETHEUS_URL","ghcr.io/pab1it0/prometheus-mcp-server:<PIN>"],
      "env": { "PROMETHEUS_URL": "http://localhost:9090" }
    }
  }
}
```

注意 Prom admin API 預設 off；若打開 `--web.enable-admin-api`，本 MCP 不可裝。

---

## P2 — @playwright/mcp（Sprint 2+ UI 真實實作後）

### 安裝指令

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@<PIN>",
        "--isolated",
        "--headless"
      ]
    }
  }
}
```

### 安全注意事項

- **`--isolated` 必開**；profile dir 不入 git
- 任意 URL navigate 為高風險——`scripts/check-no-secrets.sh` 增 web allowlist 檢查
- CI 用 `--headless` + 容器隔離

---

## User-level optional — context7

**不入 project `.mcp.json`**。建議貢獻者於 user-level 自行安裝：

```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp --api-key ${CONTEXT7_API_KEY}
```

API key 自申請 https://context7.com/dashboard。

---

## 移除全部 MCP（緊急 kill-switch）

```bash
# 列出所有
claude mcp list

# 一鍵移除某個
claude mcp remove <name>

# 重置 project 同意紀錄
claude mcp reset-project-choices

# 編輯 .mcp.json：刪所有 mcpServers
# 編輯 .claude/settings.json：deny mcp__*

# 全 disable claude.ai-hosted MCPs
export ENABLE_CLAUDEAI_MCP_SERVERS=false
```

---

## 流程：何時觸發本檔的安裝

| Trigger | Action |
|---|---|
| Sprint 1 第 1 個 PR 開出時 | P1.1 github-mcp-server |
| Sprint 1 task S1-09（kind smoke）開始前 | P1.2 kubernetes-mcp-server |
| Sprint 1 task S1-07（Prom + Grafana）docker-compose 起來後 | P1.3 grafana mcp（+ optional P1.4 prom mcp） |
| Sprint 2 task S2-02（UI Recharts）後 | P2 playwright mcp |

每個 trigger 都需先寫 ADR：`docs/adr/ADR-NNN-add-<server>-mcp.md`，列 Status/Context/Decision/Consequences。
