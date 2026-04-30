# ADR-005 — Nephio：第一版只出 kpt package stub，不跑完整 O2 IMS lifecycle

| 欄位 | 值 |
|---|---|
| Status | Accepted |
| Date | 2026-04-30 |
| Deciders | k8s-platform-engineer, architect |

## Context

Nephio R5（2025-07-31，K8s 1.26-1.32）已釋出，加入 ArgoCD GitOps reconciliation。完整 R5 環境需 management cluster + workload cluster + Porch + ConfigSync/ArgoCD + O-Cloud Manager；對 7–14 天 MVP 過重。Nephio 對 O-RAN O2 IMS / FOCOM 為 **pre-standard** 實作。

## Decision

第一版只交付：

1. `packages/nephio-stubs/orbitops-groundstation-package/` — kpt package skeleton（Kptfile + 範例 KRM resources），用語對齊 R5 慣例（`OCloud Registration`、`ProvisioningRequest`）。
2. `packages/nephio-stubs/README.md` — 說明「這是 intent-to-sandbox 範式示範，非 production O2 IMS lifecycle」。
3. ArgoCD App YAML（`deploy/k8s/base/argocd-app.yaml`）作 GitOps reference，**不要求** management cluster。

不做：跑 Porch、跑 O2 IMS operator、跑 FOCOM。

## Consequences

正面：
- 文件層次與 R5 對齊；不偽造未跑通的整合。
- 未來 P2 接管理叢集時，stub 結構可直接被消費。

負面：
- 投影片需明示「stub-level demonstrating intent」。

## Alternatives

- 全跑 Nephio R5：時間 > 4 週，否決。
- 完全不提 Nephio：失去技術錨點，否決。
