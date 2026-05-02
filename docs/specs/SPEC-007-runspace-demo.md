# SPEC-007 — runspace-demo

| Field | Value |
|---|---|
| Status | Accepted (Sprint 1 — substantively shipped 2026-05-02) |
| Owner | architect + release-engineer |
| Sprint | 3 (VS-14, VS-15, VS-16, VS-17, VS-18) |
| Depends on | SPEC-001..006 |
| Related ACs | AC-004 |

## 1. User story

> 作為 RunSpace 評審，我想要在 90 秒影片內理解 OrbitOps Copilot 在做什麼、3 分鐘影片裡看完整 demo flow、10 頁簡報能對齊評分項、整份提交檔**完全匿名**——**這樣我** 評分時不會被 team identity 干擾，能聚焦於技術。

## 2. Problem

技術做得再好，沒有匿名化、可重現、可在無網路環境播放的提交包，RunSpace 不會收。本 SPEC 把所有「demo + 影片 + 簡報 + zip 包裝 + 匿名性 + metadata 清理」綁成一個 sprint 的目標。

## 3. Scope

- 10 頁英文簡報 PDF（從 `docs/06_runspace_pitch_outline.md` 衍生）。
- 90 秒影片 .mp4（從 `docs/07_demo_script_90s.md`）。
- 3 分鐘英文字幕影片 .mp4 + .srt（從 `docs/08_demo_script_3min.md`）。
- `make archive` 產 `orbitops-copilot.zip`（內部呼叫 `git archive`，只含 tracked 檔案）。
- DoD §3.4「發行」全打勾。
- 所有提交檔通過 `claims-audit` skill（零 OVER-CLAIM）。
- 所有提交檔通過 `exiftool -all=` 後無作者欄位。

## 4. Non-scope

- 不做配音演員 / 商業級剪輯（screen capture + slide overlay 即可）。
- 不做多語言版本（英文為主）。
- 不做 live-stream demo。
- 不做 RunSpace 之外的提交（其他 contest / 媒體露出 OOS）。

## 5. Inputs

- Sprint 1 + 2 完成的 codebase 與 demo recording。
- `docs/00_research_2026_04.md` 的事實 + 來源。
- `docs/01_product_strategy.md` 的 narrative。
- `docs/06 / 07 / 08` 的草稿。
- `docs/10_links.md` allowlist。

## 6. Outputs

- `tmp/runspace-deck.pdf`（10 頁，英文，匿名）。
- `tmp/runspace-90s.mp4`（90 秒，英文字幕）。
- `tmp/runspace-3min.mp4` + `tmp/runspace-3min.srt`（3 分鐘，英文字幕）。
- `orbitops-copilot.zip`（repo 包，排除 .git/.venv/node_modules/tmp/.env）。
- `tmp/anonymity-report.txt`（exiftool 結果 + check-no-secrets 結果）。

## 7. API or file contracts

**Make / scripts**：

| Target | 用途 |
|---|---|
| `scripts/run-demo.sh` | demo replay（VS-5 / SPEC-002 已定義） |
| `make archive` | 產 orbitops-copilot.zip via `git archive` |
| `scripts/check-no-secrets.sh` | 9-pattern 掃描 |
| `exiftool -all= <file>` | metadata 清空 |

**Slash commands**：`/release <tag>` 走 DoD §3.4 流程。

**Anonymity 規則**（hard）：

- `git log --format='%ae'` 對所有 commit author e-mail：必為 anonymized（`anon@orbitops.local`、GitHub noreply）。
- 影片畫面：無 OS toolbar / browser tabs / hostname / `whoami`。
- 簡報 footer：無 author 欄位（PDF metadata 經 exiftool 清）。
- 字幕：純英文。

## 8. Acceptance criteria

對應 `docs/acceptance/AC-004-demo-replay.md`。額外：

- AC-S007-1：`exiftool -G -a -s tmp/*.mp4 tmp/*.pdf` 輸出無 `Author` / `Creator` / `Producer` 欄位含真實姓名。
- AC-S007-2：`scripts/check-no-secrets.sh` 對 working tree + `tmp/` 全 clean。
- AC-S007-3：`claims-audit` skill 表全分類為 implemented / simulated / planned / external_reference；零 OVER-CLAIM。
- AC-S007-4：90 秒影片總長 88–92 秒；3 分鐘影片 175–185 秒。
- AC-S007-5：簡報 10 頁；每外部宣稱有 footnote URL（在 docs/10 allowlist 內）。
- AC-S007-6：`make archive` 產出之 zip 解壓後可獨立 `make verify` 通過。

## 9. Test strategy

- **Anonymity**：`exiftool` + `scripts/check-no-secrets.sh` + 視覺人工檢查（影片逐幀走過）。
- **Claims**：`claims-audit` skill 跑全部 pitch 文字；output 4-column 表貼進 PR。
- **Replay**：`scripts/run-demo.sh` 連跑 3 次結果一致（determinism）。
- **Time budget**：用 `ffprobe` 量影片秒數。
- **Zip integrity**：解壓進臨時目錄、跑 `verify.sh`、確認綠。
- **Slide schema**：簡報每頁有 1 footnote URL；用簡單 Python 腳本檢查 PDF text。

## 10. Demo relevance

整個 sprint 都是 demo。Sprint review 即 RunSpace 內部 dry-run，用兩套權重（30/30/30/10 與 35/25/20/20）自評，與 `docs/00_research_2026_04.md` §5 對照。

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-S007-1 | 影片錄製露出 OS toolbar / hostname / 真實 e-mail | recording checklist；事後逐幀 review；`exiftool -all=` |
| R-S007-2 | 簡報 metadata 含作者欄位（PowerPoint / Keynote 自動填） | 用 LibreOffice / pandoc 產 PDF + exiftool 清 |
| R-S007-3 | claims-audit 發現 over-claim → 全部回頭重寫 | sprint 中段（D3）跑一次 audit，留 2 天緩衝 |
| R-S007-4 | 90 秒太緊 → 切過頭 / 看不懂 | dry-run 3 次；秒數計時 |
| R-S007-5 | RunSpace 規則臨時改（評分權重 / 提交格式） | 兩套權重已自評；提交前 24 h 重讀官方公告 |
| R-S007-6 | zip 含意外大檔（model weights / video） | `git archive` 只打 tracked 檔案；`.gitignore` 已含 `tmp/`、`.venv/`、`node_modules/`；CI 跑 size assert ≤ 5 MB |
