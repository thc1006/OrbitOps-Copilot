# 02 — MCP Security Review

> 用 10 條 MCP 安全最佳實踐審 `01_mcp_candidates.md` 的所有候選；指出每條的 mitigation 與本專案應採立場。
>
> 撰寫日期：2026-04-30。**重大事件**：2026-04-16 OX Security 揭露 stdio MCP 跨 SDK RCE，Anthropic 不修架構（[The Register](https://www.theregister.com/2026/04/16/anthropic_mcp_design_flaw/)）；2025–2026 至少 30 個 MCP 相關 CVE。

## 1. Least privilege

**原則**：每個 server 用最小權限的 token + 最小工具子集啟動。

| Server | 應用 |
|---|---|
| github-mcp-server | `--read-only` flag + fine-grained PAT 限本 repo + 只給 `Contents: read` / `Pull requests: read` / `Metadata: read` |
| kubernetes-mcp-server | `--read-only --toolsets core,config,helm`（去掉 tekton/kiali/kubevirt/kcp） + 專屬 ServiceAccount + view ClusterRole |
| grafana mcp | viewer-scoped SA token；不給 Editor / Admin |
| prometheus mcp | 確認 Prom 未開 admin API（`--web.enable-admin-api` 預設 off） |
| playwright mcp | `--isolated` + `--headless`（CI）；profile 不入 git |
| context7 | API key 僅查詢用；無寫入端點 |

## 2. Token handling

**原則**：`.mcp.json` 用 `${VAR}` 占位，**永不** commit raw token。

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run","-i","--rm","-e","GITHUB_PERSONAL_ACCESS_TOKEN","ghcr.io/github/github-mcp-server","--read-only"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

- token 由 contributor 各自於 shell（`direnv` / OS keyring / 1Password CLI / `op://`）注入
- **本 repo 的 `scripts/check-no-secrets.sh` 已能 catch GitHub PAT 字面值**（pattern：`gh[pousr]_[A-Za-z0-9]{30,}`）
- 啟用 `apiKeyHelper`（Claude Code 設定）做 token 旋轉

## 3. Local（stdio）vs Remote（HTTP/SSE）

**spec 指引**：[modelcontextprotocol.io security spec](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) 建議 `stdio` 限縮給 MCP client；HTTP transport 必走 TLS + bearer。

**Caveat（2026-04 OX Security）**：stdio 的攻擊面是 **host 等級**——任何傳給 stdio interface 的 process command 都會以使用者權限執行，即使該 binary 不是合法 MCP server。**結論**：stdio 不是天然安全，要看 server 來源。

| Server | Transport | 立場 |
|---|---|---|
| github-mcp-server | stdio (Docker) 或 remote OAuth | **stdio with Docker 隔離**（推薦）；Docker 限制是 Sprint 1 引入時的 host-blast-radius mitigation |
| kubernetes-mcp-server | stdio | OK（Docker / npx 啟動皆可，前者隔離較佳） |
| grafana / prometheus mcp | stdio | OK |
| playwright mcp | stdio | OK，但 `--isolated` 控制 profile |
| context7 | remote HTTP | OK（只送查詢字串，TLS 已啟用） |

## 4. Command execution risk

**禁止項**（已寫進 `.claude/settings.json` deny）：
- `Bash(rm:*)`、`Bash(curl:*)`、`Bash(wget:*)`、`Bash(sudo:*)`、`Bash(chmod 777:*)`
- `Bash(git push --force:*)`、`Bash(git commit --no-verify:*)`、`Bash(git config:*)`

**MCP 額外注意**：MCP server 若提供 shell-like 工具（如某些 GitHub MCP write tools 走 `gh` CLI 內部實作），實質就是把 deny 規則繞過。**結論**：Sprint 1 GitHub MCP 強制 `--read-only`。

## 5. SSRF risk

**spec 規範**（normative）：MUST 阻 RFC1918 / 169.254.0.0/16 / 127.0.0.0/8 / fc00::/7 / fe80::/10；redirect 同等檢查；DNS pin。

| Server | SSRF 暴露 | mitigation |
|---|---|---|
| playwright mcp | 高（任意 URL navigate） | 用 egress proxy；CI 限 allowlist domain；`scripts/check-no-secrets.sh` 增 web allow list |
| context7 | 低（端點固定 mcp.context7.com） | TLS pin |
| github / k8s / grafana / prom | 低（端點明確） | 不額外處理 |

**已知 CVE**：`@modelcontextprotocol/server-puppeteer` SSRF + sandbox bypass（[#3662](https://github.com/modelcontextprotocol/servers/issues/3662)）——用 Playwright 取代。

## 6. Prompt injection risk

**兩類向量**（[OWASP MCP Tool Poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning)、[Invariant Labs](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks)）：

(a) **Tool poisoning**：MCP tool 描述含隱藏指令，使用者看不見、LLM 看見。Mitigation：pin tool description hash；升級時人工 review。

(b) **Indirect injection via tool output**：抓取的 issue / PR / web page 含越獄字串。**Supabase + Cursor 2025 incident** 即此類，使支援票內字串 exfil DB token。

**本專案 mitigation**：
- copilot-api 已強制 evidence schema（ADR-004）——LLM output 必經 Pydantic 驗證；MCP 結果不能繞過 evidence 結構
- `.claude/settings.json` 用 `permissions.allow: ["mcp__<server>__<tool>"]` 顯式列舉（不用 wildcard `mcp__*`）
- 每次升級 MCP server 跑一次「tool description diff」review

## 7. Data exfiltration risk

**任何寫端點**（GitHub PR comment、Slack post、Drive upload）= exfil 通道。

**處置**：
- Sprint 1 github-mcp-server 強制 `--read-only`，待 Sprint 2 評估解開
- **永不裝** Slack / Gmail / Atlassian / Drive / Linear MCP
- CI 用 `permissions.deny` 阻所有 `mcp__*__create_*` / `mcp__*__post_*` / `mcp__*__write_*` 寫工具

## 8. Per-client / per-tool consent

**Claude Code 行為**（[code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)）：
- Project-scoped `.mcp.json` → 每個 contributor 第一次用 tool 時跳同意視窗；選擇 persist 至 `~/.claude/projects/.../mcp.json`
- 重置：`claude mcp reset-project-choices`

**本專案立場**：**不在 CI 自動 approve**。CI workflow 不啟用 MCP；MCP 限本機開發者使用。

## 9. Scope minimization

| Server | scope strategy |
|---|---|
| github-mcp-server | fine-grained PAT；`Repository access: <orbitops-copilot fork>`；最小 perms：Contents R / Pull requests R / Metadata R |
| kubernetes-mcp-server | dedicated SA `orbitops-mcp-viewer` 綁 `view` ClusterRole；專屬 kubeconfig 不含 admin context |
| grafana | SA token Viewer role；scoped 至 OrbitOps folder |
| prometheus | bearer token；basic auth 不用 |
| playwright | 無遠端 token |
| context7 | 免費 tier API key 即可 |

## 10. Logging / auditability

**spec 現況**：2026-04 spec 尚無強制 per-invocation audit log；只規範 OAuth elevation 的 correlation IDs。

**本專案做法**：
- `.mcp.json` 入 git（透明）；任何更動須 PR review（兩人）
- `apiKeyHelper` 寫入 audit log
- Claude Code session transcripts 保留於 `~/.claude/projects/`，**且禁止上傳外部**

## 11. 重大 CVE 與事件記錄（2025–2026）

| 事件 | 影響 | 對本專案決策 |
|---|---|---|
| CVE-2025-49596（MCP Inspector RCE） | inspector 工具 | 不影響——本專案不用 inspector |
| CVE-2025-53109/53110 EscapeRoute（Filesystem MCP） | 官方 filesystem server | **驗證 Filesystem MCP 不裝的決策正確** |
| CVE-2025-54136（Cursor MCP） | Cursor | 不影響 |
| CVE-2026-22252 LibreChat | LibreChat | 不影響 |
| CVE-2026-22688 WeKnora | WeKnora | 不影響 |
| Cyata Security `mcp-server-git` 3 CVE（2026-01-20） | git MCP | **驗證 git MCP 不裝** |
| OX Security stdio RCE 跨 SDK（2026-04-16） | 所有 stdio server | **加強：所有 stdio server 用 Docker 隔離** |
| Supabase / Cursor incident（2025） | 透過 ticket 注入 exfil DB token | **驗證 evidence schema 必要性** |

## 12. 結論：本專案安全立場

1. Sprint 0 不裝任何 MCP（**Must install now: 空**）。
2. Sprint 1 起裝 5 個必要 server，全部 read-only / viewer / docker-isolated。
3. 永不裝 Filesystem / git / Postgres / SQLite / cloud / Atlassian / Drive / Slack / Linear MCP。
4. `.mcp.json` 入 git；token 走 `${VAR}` + `apiKeyHelper`；CI 不啟 MCP。
5. `scripts/check-no-secrets.sh` 擴充：scan `.mcp.json` 與 `.claude/settings.json` 是否有 raw token / 真實 e-mail。
6. 升級 MCP server 流程：先看 tool description diff；通過後才 bump version pin。

## 引用

- [MCP Spec — Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [Claude Code — Connect via MCP](https://code.claude.com/docs/en/mcp)
- [Claude Code — Settings](https://code.claude.com/docs/en/settings)
- [The Register — MCP design flaw 2026-04-16](https://www.theregister.com/2026/04/16/anthropic_mcp_design_flaw/)
- [OX Security — MCP architectural flaw 2026-04](https://www.ox.security/blog/the-mother-of-all-ai-supply-chains-critical-systemic-vulnerability-at-the-core-of-the-mcp/)
- [Cymulate — EscapeRoute](https://cymulate.com/blog/cve-2025-53109-53110-escaperoute-anthropic/)
- [OWASP — MCP Tool Poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning)
- [OWASP GenAI — Secure MCP Server Development](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/)
- [Microsoft Dev Blog — Indirect injection in MCP](https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp)
- [Datadog — Postgres MCP SQLi](https://securitylabs.datadoghq.com/articles/mcp-vulnerability-case-study-SQL-injection-in-the-postgresql-mcp-server/)
- [Practical DevSecOps — MCP CVEs 2026](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
