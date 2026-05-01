# Definition of Done

> 任何 PR / slice / sprint 通過合併與發行的硬性閘門。

## 單一 PR

- [ ] 對應的 SPEC 與 AC 已存在（SDD）。
- [ ] 至少一個 failing test 已先 commit；後續 commit 讓測試由紅轉綠（TDD git history）。
- [ ] `make verify` 全綠（lint、typecheck、test、secrets、schema、k8s manifest validate）。
- [ ] PR title 為 `[SPEC-NNN] <imperative>`；body 引用對應 AC、ADR。
- [ ] commit 與 metadata 不含 team / 學校 / 姓名。
- [ ] 受影響 docs 同步更新。
- [ ] 對應 backlog item 勾選；若延後，移到下一個 sprint 並備註。

## Single slice 完成

- [ ] 所有 AC 自動測試通過（或 demo screenshot 證明人工驗收）。
- [ ] 至少 1 unit + 1 contract + 1 golden test。
- [ ] README 或 `services/<svc>/README.md` 描述如何單獨跑 slice。
- [ ] 對應 SPEC 「Open questions」更新或關閉。

## Sprint exit

- [ ] 全部 sprint scope 已關閉或顯式延後（不允許默默漏掉）。
- [ ] sprint review 文件填妥。
- [ ] backlog 與 risk-register 更新。
- [ ] CI 在 main branch 全綠（HEAD）。
- [ ] `make package-zip` 可產出 zip（從 sprint 1 起每 sprint 至少跑一次）。

## 發行（提交 RunSpace）

- [ ] `scripts/check-no-secrets.sh` + 匿名性檢查全過。
- [ ] 影片 metadata（`exiftool`）無作者欄位。
- [ ] 簡報、影片、文件、UI 截圖皆無 team/學校/姓名/Logo/內部 URL。
- [ ] 所有外部宣稱皆有 `docs/00` / `docs/10_links.md` 連結。
- [ ] 版本號通過 `verify.sh` 重新比對 GitHub Releases / PyPI（避免漂移）。
- [ ] AC-001 ~ AC-004 自動跑過 + screenshot 留存。
