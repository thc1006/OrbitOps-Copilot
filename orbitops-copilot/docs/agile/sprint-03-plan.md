# Sprint 3 — RunSpace 簡報 + 視覺化

| 欄位 | 值 |
|---|---|
| Duration | 1 週 |
| Sprint goal | **「RunSpace 提交完成」**：10 頁簡報 + 90s 影片 + 3min 英文字幕影片 + 投件 zip + claims-audit 全 pass |
| Demo | dry-run RunSpace 評審情境（內部演練），全程匿名 |

## Vertical slices

| ID | Slice | 切到的層 | Est | SPEC |
|---|---|---|---|---|
| VS-13 | CesiumJS satellite pass animation | digital-twin-ui + CesiumJS 1.140 + beam coverage cone | 2d | 004 |
| VS-14 | RunSpace 10-page slide PDF | docs/06 outline → real .pdf + claims-audit | 1d | 007 |
| VS-15 | 90-second demo video | docs/07 script → real .mp4（exiftool 清 metadata） | 1d | 007 |
| VS-16 | 3-minute English-subtitled video | docs/08 script → real .mp4 + .srt 字幕 | 1d | 007 |
| VS-17 | Nephio kpt package full doc | packages/nephio-stubs/ + kpt fn render dry-run | 0.5d | 006 |
| VS-18 | Pre-submission audit + zip | claims-audit + check-no-secrets + exiftool + `make package-zip` + DoD §3.4 | 0.5d | 007 |

## Acceptance gates

- [ ] 三份提交檔（PDF + 2 個 MP4）皆通過 `exiftool -all` 後無作者欄位
- [ ] `claims-audit` skill 對所有 pitch 文字回零 OVER-CLAIM
- [ ] `make verify` 6/6
- [ ] `scripts/check-no-secrets.sh` 對全 working tree + tmp/ 投件檔 clean
- [ ] zip 內無 `.git/` / `.venv/` / `.env*` / 個人 metadata
- [ ] DoD §3.4「發行」checklist 全打勾

## Risks

- 影片錄製時若終端 prompt / 工具列露出識別 → 全部重錄
- CesiumJS 1.140 plugin 版本相容性 → user-level smoke 先過
- Sprint 1/2 carry-over 太多 → 縮 VS-13（CesiumJS）為 P2、保留 VS-14/15/16/18

## Demo

內部評審 dry-run；用 RunSpace 30/30/30/10 與 35/25/20/20 兩套權重自評。
