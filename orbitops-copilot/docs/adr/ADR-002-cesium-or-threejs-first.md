# ADR-002 — CesiumJS（主）/ Three.js（備），不用 Isaac Sim 作 RAN ray-tracing 核心

| 欄位 | 值 |
|---|---|
| Status | Accepted |
| Date | 2026-04-30 |
| Deciders | architect |

## Context

MVP 需要 web-based satellite pass、ground station、beam 視覺化。Isaac Sim / Omniverse 為 3D 場景與數位孿生視覺層；AODT / Sionna RT 為 RF/beam/channel 模擬；CesiumJS / Three.js 為 web 端視覺化。三者責任不同，常見錯誤是把 Isaac Sim 當 RAN ray tracer 引用。

## Decision

第一版用 **CesiumJS 1.140**（已驗證為 2026-04 release）作 satellite pass / 地面站 / beam 視覺化主軸；備案 Three.js r184。**不引用 Isaac Sim 作 RF 模擬**；RF 只在 P2 才接 Sionna RT。

## Consequences

正面：
- web-based、無 Omniverse 工作站依賴。
- 軌道 / 地面站 / beam 邊界現成 API 充足。

負面：
- 不能宣稱 RF 物理保真。

## Alternatives

1. **Isaac Sim**：3D 強，但作 RF/RAN ray-tracing 為誤用；GPU 重；非 web。否決。
2. **AODT**：完整 digital twin，但截至 2026-04 是否完整 OSS 上 GitHub 仍需驗證。P2。
3. **Three.js**：可，但對軌道 / 球面座標 API 較少；備案。
