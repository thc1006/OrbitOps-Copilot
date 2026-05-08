# SPEC-S006-2 — Closed-loop GitOps reconcile (DESIGN PHASE)

| Field | Value |
|---|---|
| Status | Draft (2026-05-08) — Sprint-4 VS-21 **DESIGN ONLY**; impl deferred to Sprint-5+ |
| Parent | SPEC-006 (k8s-deployment) |
| Owner | architect + k8s-platform-engineer + llm-copilot-engineer |
| Sprint | 4 design phase (VS-21); Sprint-5+ impl |
| Depends on | SPEC-003 (copilot-api), SPEC-S003-2 (auth), ADR-004 (LLM grounding contract), ADR-009 (Helm service naming) |
| Related ACs | AC-S006-2 |
| Research basis | `docs/00_research_2026_04.md` §"Sprint-4 技術選型 T3" (2026-05-08) — KubeCon EU 2026 reference; Akuity + Intuit `argoproj-labs/mcp-for-argocd`; Kargo v1.3 |

## 1. Goal — DESIGN PHASE

**Sprint-4 範圍：完成 SPEC + AC + ADR-013 (apply mechanism decision)，把 Sprint-5 impl 的所有設計問題逼出來並決議**。不寫 code。產物：

- 本 SPEC 文件（含 safe action surface、apply mechanism、observation harness、approval flow、rollback、threat model）
- AC-S006-2（含 design-phase ACs + impl-phase ACs 兩組）
- ADR-013-closed-loop-apply-mechanism（Sprint-4 sprint exit 必須 commit）

**Sprint-5+ 範圍**（**不在本 SPEC 涵蓋**）：上述設計的 implementation。

## 2. Vision (post-impl, for design context)

```
[/scenarios load anomaly]
    ↓
[copilot-api /runbook → ActionPlan{action_id, rationale, inverse_action_id, evidence}]
    ↓
[UI shows Apply / Dismiss button + rationale + 30s metric preview]
    ↓ user clicks Apply
[copilot-api /action/{id}/apply → git commit + push to deploy-overrides branch]
    ↓
[Kargo v1.3 promotion pipeline (mandatory human-approval step) → ArgoCD sync]
    ↓
[copilot-api subscribes to relevant metrics for 5 min; returns "before/after" delta]
    ↓
[UI shows resolution + Undo button (apply inverse_action)]
```

**Key invariants** (informed by KubeCon EU 2026 community consensus, codecentric blog, Red Hat AI-agent guardrails):
1. LLM **MUST NEVER** auto-apply — human Approval is hard requirement (forbidden by ADR-004 grounding policy + 2026 GitOps consensus).
2. All mutations travel git → ArgoCD path (audit trail, single source of truth). **Direct in-cluster `kubectl patch` from a copilot-api ServiceAccount is an anti-pattern called out at KubeCon EU 2026 — explicitly rejected**.
3. AI-initiated commits are rate-limited (max 1 per 5 min per scenario_id) and include LLM-attribution metadata in commit message body.
4. Every action MUST have a documented inverse (rollback path).
5. observation harness is bounded (5 min default), not open-ended (prevents stuck "waiting" UX).

## 3. Non-goals (Sprint-4 DESIGN, AND for the eventual Sprint-5 impl)

- **No real Kargo deployment in Sprint-4** — design-only (Sprint-5 may stub Kargo step; Sprint-6+ may integrate real Kargo).
- **No production cluster execution** — kind / kubeadm local cluster only.
- **No Argo Image Updater / Argo Rollouts** — research confirmed off-topic (image lifecycle, not config mutation).
- **No multi-cluster orchestration** — single-cluster only.
- **No autonomous LLM agent loop** (LLM observes outcome → re-suggests → re-applies without human) — explicitly forbidden.

## 4. Inputs (current state, 2026-05-08)

- ArgoCD App reference exists at `deploy/argocd/orbitops-copilot.yaml` (Sprint-2 VS-11; PR #50).
- Kargo: NOT installed (Sprint-5 impl will decide whether to install or stub).
- copilot-api `/runbook`: returns string-ish runbook in `RunbookResponse`; **does not yet emit structured `ActionPlan`** with action_id / inverse / parameters.
- digital-twin-ui Copilot panel renders runbook as plaintext steps; **does not yet have Apply / Dismiss buttons**.
- No git-PR-creation path from copilot-api; no GitHub App token mechanism.
- ADR-004 (LLM grounding) prohibits ungrounded answers but does not yet have a clause for "AI-initiated cluster mutations" — **must extend** in this sprint as part of design.

## 5. Outputs (Sprint-4 DESIGN deliverables)

### 5.1 Safe action surface (3 actions; rationale per item)
| Action ID | Description | Inverse | Why "safe" |
|---|---|---|---|
| `scale_copilot_api_replicas` | Set `spec.replicas` of `Deployment/copilot-api` to N (1..3) | `scale_copilot_api_replicas` with previous N | Idempotent; bounded range; pure capacity adjustment; metric ripple visible in 30s (orbitops_copilot_request_latency_p95) |
| `restart_emulator_pod` | `kubectl rollout restart deploy/ntn-metrics-emulator` (translates to `metadata.annotations` patch) | None (rolling restart is intrinsically forward-only; "undo" = wait for next pod cycle) | Pod-level recovery; no data loss (emulator state in-memory, intentionally; demo state recoverable from `/scenario/load`) |
| `set_payload_mode` | Patch `Deployment/ntn-metrics-emulator.spec.template.spec.containers[0].env[NAME=PAYLOAD_MODE].value` to `regenerative` or `transparent` | `set_payload_mode` with previous value | NTN domain-meaningful (3GPP Rel-19); changes scenario semantics but is fully recoverable; metric ripple visible (orbitops_anomaly_active rebases) |

**NOT in safe surface (deliberately rejected for Sprint-5)**:
- ❌ Scale beyond 3 replicas (resource budget on kubeadm single-node)
- ❌ Modify ConfigMap of Prometheus / Grafana (observability sacrosanct)
- ❌ Delete pods directly (rolling-restart suffices)
- ❌ Modify Service ports / NodePort (network surface)
- ❌ Anything in `kube-system` / `argocd` / `cert-manager` namespaces

### 5.2 Apply mechanism — DECISION (to be ratified in ADR-013)

**Recommended: git commit + Kargo v1.3 promotion (with mandatory human-approval step) + ArgoCD sync.**

Rejection rationale for the alternative:
- **Direct kubectl from in-cluster ServiceAccount**: explicitly called out as anti-pattern at KubeCon EU 2026 (Akuity + Intuit MCP for ArgoCD talk). Bypasses git audit trail, breaks single source of truth, blocks regulated-environment compliance.

Concrete flow (Sprint-5 impl):
1. UI Apply button → copilot-api `POST /action/{id}/apply` with `Authorization: Bearer <jwt>` (SPEC-S003-2)
2. copilot-api validates rate-limit (1 per 5 min per scenario_id), constructs Kustomize patch under `deploy/k8s/overlays/local/closed-loop-overrides/`, commits to a dedicated branch `closed-loop/auto/<timestamp>-<sub>` via GitHub App PAT (env `CLOSED_LOOP_GH_APP_TOKEN`)
3. Kargo v1.3 promotion pipeline picks up the branch; `requiresVerification: true` step pauses for human approval; once approved, Kargo merges to `main` (or to a deploy branch) and triggers ArgoCD sync
4. ArgoCD reconciles cluster state
5. copilot-api `/action/{id}/observe` polls relevant Prom metrics for 5 min, returns `MetricRipple{baseline, post_apply, delta_p95}`

### 5.3 Approval flow (UI + RBAC)
- UI MUST render "Apply / Dismiss" with rationale before any action POST. **No keyboard shortcut**.
- Backend RBAC: copilot-api ServiceAccount has **read-only** in-cluster RBAC by default. Write capability is **NOT** granted (writes go via git, not kubectl).
- Kargo approval step: human approval via Kargo UI or CLI; recorded in audit log.
- Audit log: every `/action/{id}/apply` writes a JSON record to Loki (kid: `closed_loop_audit`) — `{ts, sub, action_id, action_params, scenario_id, llm_response_id, commit_sha}`.

### 5.4 Observation harness
- `/action/{id}/observe?since=<commit_ts>&duration=300s`:
  - Polls Prometheus every 30s for the 5-min window
  - Returns `MetricRipple { metric_id, baseline_p95, post_apply_p95, delta_pct, samples_n }` for relevant metrics (per action)
- Bounded: 5 min hard cap. After window, returns final ripple. **Never** open-ended subscription (UX hazard).

### 5.5 Rollback / Undo
- Every `MetricRipple` UI render includes an "Undo" button if `inverse_action_id` is non-null.
- Undo = same flow but with inverse action; same approval gate; same rate-limit clock.

### 5.6 Threat model (Sprint-4 design output)
| Threat | Mitigation |
|---|---|
| LLM hallucinates impossible action_id | API rejects unknown action_id (whitelist enforcement; 422) |
| LLM-suggested action causes cluster damage | Human-approval gate; bounded action surface (§5.1); rate-limit |
| Compromised UI submits forged action | JWT (SPEC-S003-2) + per-route audience check; sub recorded in audit |
| Race: rapid-fire identical actions | Rate-limit (1 per 5 min per scenario_id); dedupe by action_id+params hash |
| Git PR queue flood | Rate-limit + Kargo `pendingPRs.maxOpen` config |
| ArgoCD sync after revert leaves stale state | Kargo `requiresVerification` + `cleanup` step in promotion pipeline |
| Observation window stuck | 5-min hard cap |
| Inverse action inversion ambiguity | Each action's inverse documented in §5.1 table; reviewed at SPEC review |

## 6. Constraints

- **2026 GitOps community consensus**: AI-initiated mutations MUST go via git → ArgoCD path. SPEC binds this.
- **ADR-004 LLM grounding extension** (NEW; written in this sprint): "AI suggestions targeting cluster state mutations require explicit human approval; auto-apply is forbidden". Add this clause to ADR-004 in the same impl PR as ADR-013.
- **No autonomous loops**: copilot-api MUST NOT call its own `/runbook` to chain actions without UI approval per step.
- **Audit log retention**: closed-loop audit records sit in Loki for ≥ 30 days (matches existing observability retention; tweak only via separate ADR).
- **Anti-pattern Chain #X (process)**: Sprint-5 impl PRs MUST follow red→green→refactor; the safety guards listed above are testable in unit form (rate-limiter unit test; approval-gate integration test; rollback round-trip test).
- **Anti-pattern Chain #6 (partial-migration)**: when Sprint-5 ships, ALL 3 actions in §5.1 ship together with their inverses + observation harness; **no partial enable**.

## 7. Open questions (resolve at ADR-013 / Sprint-5 kickoff)

1. **Kargo install footprint** for kubeadm single-node: does Kargo controller fit in current resource budget? — Sprint-5 spike (1 day) before impl.
2. **GitHub App token scope**: PAT with `contents:write` to a dedicated repo branch is principle-of-least-privilege OK. Alternative: ArgoCD app-of-apps with private chart repo. — Settle in ADR-013.
3. **Stub Kargo vs install Kargo**: Sprint-5 may stub the Kargo step (skip directly to ArgoCD sync after manual approval) for MVP; full Kargo integration in Sprint-6.
4. **Copilot-api in-cluster vs out-of-cluster** for git ops: out-of-cluster (CI runner pattern) avoids ServiceAccount RBAC question entirely. — Consider for ADR-013.
5. **Real LLM provider behavior** when asked for ActionPlan: structured-output reliability with mock provider 100%, with real Ollama Qwen3.6 unknown. — Sprint-5 must measure during impl.

## 8. Acceptance criteria

See `docs/acceptance/AC-S006-2-closed-loop-gitops-reconcile.md` (split: design-phase ACs for Sprint-4; impl-phase ACs for Sprint-5+).

## 9. Anti-pattern accountability

- **Chain #1 grep-verify**: every cited package / version / KubeCon talk verified via researcher (2026-05-08).
- **Chain #3 cross-page alignment**: ADR-004 grounding clause must be extended in same PR; SPEC-006 must learn the new closed-loop section as cross-ref.
- **Chain #6 partial-migration**: §5.1 actions ship together in Sprint-5; no half-shipped action surface.
- **Chain #X process**: this SPEC IS the regression-test-first practice for a non-trivial design — design phase BEFORE impl.

## 10. Sources

See `docs/00_research_2026_04.md` §"Sprint-4 技術選型 T3" (2026-05-08); 6 citations including KubeCon EU 2026 recap, Akuity + Intuit MCP for ArgoCD, Kargo v1.3 release notes, Red Hat AI-agent guardrails.
