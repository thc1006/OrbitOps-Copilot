# Sprint Review — Sprint <NN>

| 欄位 | 值 |
|---|---|
| Sprint | NN |
| Dates | YYYY-MM-DD ~ YYYY-MM-DD |
| Facilitator | <role> |
| Demo recording | tmp/sprint-<NN>-demo.mp4（exiftool 清 metadata 後） |

## Sprint goal restatement

> （從對應的 sprint-NN-plan.md `Sprint goal` 欄位複製）

## Sprint outcome

| Vertical Slice | Status | AC pass | TDD red commit | Notes |
|---|---|---|---|---|
| VS-N | ✅ done / ⏳ carry-over / ❌ blocked | AC-XXX ✓ | <commit-sha> | … |

## What we shipped

- VS-N — 1 句話描述對使用者可見的價值
- ...

## What we did NOT ship（and why）

- VS-N — 原因 + 是搬下個 sprint 還是放回 backlog

## Metrics

- AC pass rate: X / Y
- `make verify` green: yes / no（如 no，列原因）
- New backlog items opened during sprint: N
- Risks closed / opened（risk-register 更新行數）

## Demo recap

- 鏈結 / screenshot：tmp/sprint-<NN>-demo.mp4 + tmp/sprint-<NN>-screenshot.png
- 觀察到的 UX issues / surprises：…

## Retrospective

| Continue | Stop | Start |
|---|---|---|
| | | |

## Action items

- [ ] action — owner — due
- [ ] action — owner — due

## Risk register diff（本 sprint）

- New: R-XX「<title>」
- Closed/Mitigated: R-YY
- Re-scored: R-ZZ（L:n→m / I:n→m / Score:n→m）

## Next sprint adjustments

- 預計 sprint goal：…
- carry-over slices：VS-…
- 新增 backlog candidates：…

## Anonymity audit

- [ ] sprint review notes 不含 team / 學校 / 姓名
- [ ] demo 影片 metadata `exiftool -all=` 清空
- [ ] screenshot 已遮 OS toolbar / browser tabs / hostname

## Sign-off

- [ ] PO（接受 sprint outcome）
- [ ] Architect（spec / ADR 一致性）
- [ ] Security-reviewer（anonymity + secrets）
- [ ] Release-engineer（DoD §3.3 ready）
