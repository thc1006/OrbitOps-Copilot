# Sprint 0 — Bootstrap（Status: Closed）

| 欄位 | 值 |
|---|---|
| Duration | 2026-04-30（同日完成） |
| Goal | 建立 repo 骨架、工程憲法、Phase 1 研究 |

## Scope

- repo skeleton（services / deploy / observability / packages / tests / scripts / .claude / .github）
- CLAUDE.md（含 SDD/TDD/Agile 憲法）、AGENTS.md
- docs/00 research、docs/01–05 Phase 2 框架
- SPEC-000~007、AC-001~004、ADR-001~005
- agile/{backlog, DoD, risk-register, sprint-review-template}
- tests/contracts/*.schema.json、tests/golden/*.expected.json
- verify.sh、test.sh、Makefile、ci.yml
- README、CONTRIBUTING、.env.example、.gitignore、PROJECT_STATUS

## Out

- 任何業務功能實作
- UI 完整化、CesiumJS 動畫
- 真 LLM 接入

## Definition of Done

見 `definition-of-done.md`。Sprint 0 通過條件：
- 所有上列檔案存在且通過 `make verify`（lint placeholder + secrets scan + schema validation 等）
- 工程憲法已被 PR review 並 merge
- 下一個 sprint plan 已起草

## Demo

無實作 demo；提供「跑 `./verify.sh` 全綠 + 列出檔案樹」即視為 Sprint 0 demo。

## Retrospective slot

待 Sprint 0 review 會議時填入 `sprint-review-template.md` 副本。
