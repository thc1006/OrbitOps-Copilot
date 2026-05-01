# Demo path E2E audit — 2026-05-01

| Field | Value |
|---|---|
| Auditor | Claude Code (auto-mode) under user direction |
| Cluster | kubeadm `cloudnative-dev-telco` (NodeIP `31.41.34.19`, kubelet 1.35.4, containerd 1.7.24) |
| Scope | UC1 (beam quality copilot) + UC2 (runbook generation) end-to-end through the live UI |
| Trigger | User asked "really G6/G7/G8 done?" — required actual demo-path validation, not just unit tests |

## Method

Walked the *actual browser-equivalent* request path that a RunSpace evaluator would experience:

1. Cluster baseline (pods/services/NodePorts/Prom targets)
2. UI HTML + JS bundle + CSS load
3. CORS preflight from UI origin to each backend
4. Real API end-to-end (load → tick → /ask)
5. Grafana dashboard rendering with live data

## Findings

### ✅ Working as advertised

| # | Surface | Result |
|---|---|---|
| 1 | 5 pods Running 90 min+ no restarts | ✓ |
| 2 | 5 NodePorts (30073/30080/30081/30030/30090) all HTTP 200 | ✓ |
| 3 | Prom targets `copilot-api` + `ntn-metrics-emulator` + self all `up` | ✓ |
| 4 | UI `index.html` (401 B) + JS bundle (491 KB) + CSS (52 KB) all 200 + correct MIME | ✓ |
| 5 | CORS preflight `OPTIONS /ask` from `http://31.41.34.19:30073` → 200 with `access-control-allow-origin: http://31.41.34.19:30073` | ✓ |
| 6 | CORS preflight `OPTIONS /scenario/load` on emulator → 200 | ✓ |
| 7 | CORS preflight `OPTIONS /api/v1/query` on Prometheus → 204 | ✓ |
| 8 | `POST /scenario/load` → `t=0`, 3 beams loaded | ✓ |
| 9 | `POST /scenario/tick {seconds:90}` → t=90, `active_anomalies=["snr_drop"]` | ✓ |
| 10 | `POST /ask {"question":"Why is beam-1 SNR low?"}` → `status=ok`, summary cites `orbitops_beam_snr_db=6.5 dB`, confidence 0.78, 3 recommended actions | ✓ |

### 🛠️ Critical break — fixed during audit

**Grafana dashboard ConfigMap drift** — live cluster ran the pre-PR-#34 dashboard.

| Surface | Before audit | After audit |
|---|---|---|
| `kubectl get configmap orbitops-grafana-dashboards` | 7 panels (no elevation) | 8 panels (elevation panel id=8 present) |
| `GET /api/dashboards/uid/orbitops-overview` (Grafana UI) | 7 panels rendered | 8 panels rendered |

**Root cause**: Grafana pod started 3 h before PR #34 merged. Provisioning `updateIntervalSeconds=30` would have detected dashboard JSON changes IF the ConfigMap had been updated, but `kubectl apply` was never run after PR #34 — manifests on disk and live ConfigMap drifted.

**Fix applied during audit (live cluster, not committed)**:
```bash
kustomize build deploy/k8s/overlays/local --load-restrictor=LoadRestrictionsNone | kubectl apply -f -
kubectl -n orbitops rollout restart deployment/grafana
kubectl -n orbitops rollout restart deployment/prometheus
```
After restart: 8 Grafana panels, 3/3 Prom targets up, Prom scrape config also confirms `copilot-api` job present (was added in PR #34's `prometheus-configmap.yaml` change).

**Lesson for future**: Whenever a PR touches `observability/grafana/dashboards/*.json` or `observability/prometheus/prometheus.yml`, a deploy step is required for the live cluster to pick up the change. Recommend a `make k8s-reload-observability` target that does the apply + restart sequence.

### ⚠️ UX nit (not blocker, demo-script-relevant)

If a user opens the UI fresh and asks Copilot a question without first loading + ticking a scenario into the anomaly window, `/ask` returns `INSUFFICIENT_EVIDENCE` with `metrics_used=0`. This is **by design** (PR-β: defensive degrade rather than fabricate), but a RunSpace evaluator who skips Step 1+2 of the demo would see "broken Copilot" instead of "no evidence yet."

**Mitigation** for the 3-min demo:
- Demo script must explicitly walk Scenarios → Load → Tick (+90 s into anomaly) → Copilot.
- Or add a UI affordance: "Ready for Copilot" button on Scenarios page that pre-ticks to a known-anomalous `t`.

The UI already has all the underlying primitives (`loadScenario`, `tickScenario` in `src/api.ts`); just needs orchestration glue.

## Verdict

Demo path is **substantively healthy** end-to-end. The one critical break (Grafana ConfigMap drift) was unfixable from git alone — required a deploy step against the live cluster. It is now fixed in-cluster. Code/manifests on disk were already correct.

Next-session pickup:
- Add `make k8s-reload-observability` target so future obs PRs don't have the same trap
- Consider the "Ready for Copilot" UI affordance OR document the strict 4-step demo flow in `docs/08_demo_script_3min.md`
- Continue to Phase B (claims audit on docs/06–08)
