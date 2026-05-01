# 05 — Validation Plan

## 1. Unit tests（per service）

| Service | 必有單元測試 |
|---|---|
| scenario-generator | template loading、schema validation、deterministic seed |
| ntn-metrics-emulator | `(scenario, t) -> metrics` 純函式；每個 metric 公式範圍、anomaly 注入正確 |
| copilot-api | provider adapter；evidence builder；PromQL stub；prompt template |
| digital-twin-ui | logger 模組；ApiError；`<CopilotPanel />` 渲染 evidence；i18n key 完整 |

執行：`pytest`（py 服務）/ `vitest`（ts 服務）。

## 2. API tests

- `GET /healthz` → 200 + `{"status":"ok"}`。
- `POST /ask` / `/explain` / `/runbook` → 通過 `tests/contracts/copilot-response.schema.json`。
- 缺欄位 → 400 + structured error。
- LLM provider 失敗 → 503 + `INSUFFICIENT_EVIDENCE`。

## 3. Simulation golden scenarios

`tests/golden/*.expected.json` 為錨；emulator + copilot 重播 scenario 後 diff 必須 ≤ tolerance。

| Scenario | Expected key indicators |
|---|---|
| beam-degradation | t=60s 後 beam-1 SNR < 8 dB；UC1 answer 含 beam-1 |
| handover-failure | handover_failures_total 累積；UC2 runbook 5 step |
| gateway-fallback | gateway pod_health 變 0；fallback 建議含 "fallback profile" |

## 4. Demo replay tests

`scripts/run-demo.sh` 寫出 `tmp/demo-output.json`；CI 上跑（headless docker-compose）並驗 schema 與關鍵字。

## 5. Metrics correctness tests

- 對每個 emulator 指標：值域檢查（SNR ∈ [-30, 50] dB、packet_loss ∈ [0,1]、Doppler residual ∈ [-50, 50] kHz 等）。
- 對每個 anomaly：注入後對應 gauge 變動 > epsilon。

## 6. LLM output grounding tests

- **AC-003.1 grounding**：給 metrics → answer 必引用至少一個 metric name。
- **AC-003.2 hallucination**：不給 metrics → 必回 `INSUFFICIENT_EVIDENCE`。
- **AC-003.3 injection**：含 jailbreak 字串 → 不暴露 system prompt。
- **AC-003.4 schema**：所有輸出 Pydantic 驗證；retry 1 次後降級。

## 7. Kubernetes deployment smoke tests

- `kustomize build deploy/k8s/overlays/local | kubectl apply --dry-run=client` 通過。
- `helm template deploy/helm/orbitops-copilot/` 通過。
- kind 起 cluster + apply + 等 pods Ready ≤ 90s + curl `/healthz` 全綠。

## 8. Security checks

- `scripts/check-no-secrets.sh`：detect `.env`、AKID、private key header、e-mail patterns、team 白名單字串。
- `pip-audit`（Python）/ `npm audit`（Node）—— P1 啟用。
- Trivy（image scan）—— P1 啟用。
- exiftool 影片／PDF metadata 清理。

## 9. Anonymous submission checklist

- [ ] commit author / e-mail 為 anonymized 別名。
- [ ] 影片字幕、簡報、文件、UI 截圖、UI title 不含 team / 學校 / 姓名 / Logo。
- [ ] PDF / mp4 metadata 經 `exiftool -all=` 清空。
- [ ] 所有外部連結 allowlisted（`docs/10_links.md`）。
- [ ] Demo 錄製時 OS toolbar / browser tabs / `whoami` / hostname 已隱藏。
- [ ] `git log` 無團隊／學校／姓名／真實 e-mail。
- [ ] zip 內無 `.git/`（`make archive` 用 `git archive`，只打 tracked 檔案，`.git/`、`.venv/`、caches 自動排除）。

## 10. CI gates

```
.github/workflows/ci.yml:
  - lint               (ruff + eslint placeholder)
  - typecheck          (tsc -b + mypy optional)
  - unit tests         (pytest + vitest)
  - schema validation  (jsonschema check on contracts + scenarios)
  - secrets scan       (scripts/check-no-secrets.sh)
  - k8s manifest       (kustomize build + kubectl apply --dry-run=client)
  - docker build       (docker build --no-push)
  - anonymity check    (grep for team-name allowlist)
```

CI 必須全綠才可 merge。
