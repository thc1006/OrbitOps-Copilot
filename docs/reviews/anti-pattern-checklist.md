# Anti-pattern checklist — pre-PR

> 走過去 7 條 code chain + 1 條 process chain。**任何一條適用而沒被驗證 = PR description 不誠實**。
> 不適用就標 `N/A — <理由>`，不要靜默跳過。
> 來源：PR #75/#76（#1）、#77/#78（#2）、#79（#3、#4）、#80（#5）、#81 self-review（#6）、#88（#7、#X）。
>
> **Numbering history note**：`docs/releases/v0.1.3-dev-sprint3.md` §8 使用 informal 1–5 列表 + "a 6th: partial-migration"。本 checklist 是 post-Sprint-3 canonical registry，把那個 informal 6th 提升為正式 Chain #6，PR #88 surfaced 的 Resium reference-stability 排在 Chain #7。SPEC-S004-13e + ADR-011 Appendix A 在 PR #88 寫的「Chain #6 (NEW)」是 off-by-one bug，已於 PR #89 (this commit) 修正為 Chain #7。

## 使用方法

1. 開 PR 前 / `/review` 前，把下面 7 條 code chain + 1 條 process chain 走一遍。
2. 對每條 chain 在 PR body 寫一行：`Chain #N: <verify 結果或 N/A 原因>`。
3. PR template 可以 copy 整段；自查不誠實，後面 reviewer 抓到要回追，比現在多花 3 倍時間。

---

## Chain #1 — grep-verify before write

**規則**：任何 path / function / variable / count / line number 出現在 SPEC、AC、ADR、PR body 之前，必須是 grep 驗證過真的存在。

**Why**：PR #75/#76 反例 — 寫 "X 在 line Y" 沒 grep 過，X 已被改名。Reviewer 看到引用無法 navigate 就掉信任。

**How to apply / verify**：
```bash
# 寫 "function_name" 之前
grep -rn "function_name" services/ packages/

# 寫 "AC-XXX 由 src/foo.tsx:42 實作" 之前
grep -n "<expected literal>" services/digital-twin-ui/src/foo.tsx
```
零命中 = claim 是錯的，重寫。

**現有 enforcement**：無自動 gate；靠 reviewer 手動 catch。可以加 `scripts/check-grep-claims.sh` 但目前 ROI 不值得（claim 種類太多）。

---

## Chain #2 — POST-WRITE verify

**規則**：每次 `Edit` / `Write` 之後，重新 grep / `json.load` / `find` 確認效果。**Tool 回傳 success ≠ 改動真的進去**。

**Why**：PR #77/#78 反例 — Edit 回傳 success 但 `old_string` 含隱形空白不 match，`new_string` 沒寫進去；之後 5 個 commit 都建立在「以為改了」之上。

**How to apply / verify**：
```bash
# Edit "old" → "new" 之後
grep -n "new" path/to/file
# 也應 grep -n "old" 確認沒殘留
```
JSON / YAML 改完跑 `python -c "import json; json.load(open('x.json'))"` 或 `yamllint`。

**現有 enforcement**：CLAUDE.md hook 會在 Edit 後輕量驗證（部份）；`verify.sh §1a` lint + §3 schema gate 是 last line of defense。

---

## Chain #3 — Cross-page semantic alignment

**規則**：共享概念（status threshold、color、label、enum）只能有**單一 canonical source**。Per-page namespace 只放真正 page-local 的字串。

**Why**：PR #79 反例 — `colorFromSnr ≤6/≤12 dB` 與 `BeamView.health` 兩套 threshold 對 SNR=11 dB 顯示不同顏色 / 不同 status，使用者看兩頁同一條 beam 結論不一致。

**How to apply / verify**：
- 加 threshold / color → 先 `grep -rn "snr_db\|health\|status" services/` 看是否已有 canonical。
- 加 i18n key → 先看 `nav.*` / `common.*` 共享 namespace 是否已涵蓋；只有真正 page-only 才放 page namespace（見 SPEC-S004-5b §"Cross-page key alignment"）。
- 改 enum value → grep 全 repo 確認所有 callsite 同步。

**現有 enforcement**：
- `vitest src/i18n/i18n.test.tsx` 驗 en/zh-TW key 對齊（不驗 cross-page semantic）。
- 無自動 cross-page semantic gate；靠 SPEC + reviewer。

---

## Chain #4 — NaN guard

**規則**：任何**數值路徑**可能收到 `Number.NaN` 必須前置 `Number.isFinite()` guard。`Math.max(NaN, 5) === NaN`，會 propagation 到所有下游 UI。

**Why**：PR #79 反例 — `Math.max(...emptyArr)` 回傳 `-Infinity`，後續算 normalized fraction 全變 NaN，sparkline 畫不出來但沒報錯。

**How to apply / verify**：
- 任何 `Math.max(...)` / `Math.min(...)` / `arr.reduce(...)` over array → 先 guard：
```ts
if (arr.length === 0 || !arr.every(Number.isFinite)) return null;
```
- Division → guard divisor：`if (denom === 0 || !Number.isFinite(denom)) return null`.
- API 回應數值欄位 → schema 驗證後再 cast；`Number(x)` 要配 `Number.isFinite(n)` check。

**現有 enforcement**：無；靠 unit test 故意餵空 array / NaN。

---

## Chain #5 — first-call-only ignore

**規則**：任何「init」/「lazy」/「memoize」函式如果可能被呼叫多次，**第二次以後的呼叫必須處理參數變化**。「已 init 過 → no-op」通常是 bug。

**Why**：PR #80 反例 — `initI18n("zh-TW")` 在 `initI18n("en")` 之後 silently no-op，因為 i18next 已經 initialized；UI 永遠卡在第一次的語言。修法：
```ts
if (i18next.isInitialized && lng && lng !== i18next.language) {
  await i18next.changeLanguage(lng);
}
```

**How to apply / verify**：
- 任何 `if (initialized) return` / `if (instance) return instance` → 確認後續呼叫如果**參數變了**也是合法的。
- 寫測試呼叫兩次餵不同參數，斷言第二次的參數真的生效。

**現有 enforcement**：`vitest src/i18n/i18n.test.tsx` 有 PR #80 review #1 regression test (呼叫 `initI18n("en")` 後再 `initI18n("zh-TW")` 應切語言)。模式可複製到其他 lazy-init 程式碼。

---

## Chain #6 — partial-migration（class-wide 遷移看似完整其實沒完）

**規則**：當執行「把 class X 從系統 A 遷到 B」這類 mass-migration（i18n key 抽取、color token 化、ORM rename、API surface migrate），**不能靠 visual spot-check 認定完成**。必須有 enumerative test 走遍整個 surface，fail 的數量 == 預期遷移數量。

**Why**：PR #81 self-review 反例 — 多頁 i18n migration 看似完整，但**串接/模板**字串（`'Loaded ' + name + ': ' + count + ' beams'` 這種 concat）繞過了 key 抽取，translation extractor 跟單純 `grep "Loaded "` 都看不到。zh-TW 使用者在 feedback toast 看到 "Loaded foo: 3 beams" 混合英文。fix：抽到 `scenarios.feedback.loadSuccess` + i18next interpolation + `$t()` cross-bundle reference；加 `zh-no-english-leak.test.tsx` mount 每頁在 zh-TW、斷言 rendered DOM 零 ASCII 英文字母。

**How to apply / verify**：
- **i18n migration**：mount 每頁在目標 locale 的 smoke test，斷言 rendered DOM 零 ASCII English（`zh-no-english-leak.test.tsx` pattern）。
- **Color/style token migration**：ESLint rule 禁 component 內 hex literal。
- **ORM / API rename**：grep + LSP "find references" 雙確認舊 surface 零 callsite；加 deprecation runtime log 過渡一段時間。
- **通用原則**：寫一個會 fail 的測試**枚舉整個 class**（不是抽樣），看 fail 的數量是否 == 預期遷移數量；migration 完應該全綠。

```bash
# i18n 例：找出可能繞過 key 抽取的英文模板字串
grep -nE "['\`][^'\`]*[A-Z][a-z]+ (of|in|at|to|on|by) " \
  services/digital-twin-ui/src/pages/*.tsx services/digital-twin-ui/src/components/**/*.tsx \
  | grep -vE "(import|from |//)"
```

**現有 enforcement**：`src/i18n/zh-no-english-leak.test.tsx`（PR #81 self-review；i18n 子類）。其他子類（color/ORM）目前無 generalized gate；下次有類似 mass-migration 再開對應 enumerative test。

---

## Chain #7 — Resium / Cesium reference-stability

**規則**：Resium 1.21 對 `Entity` / `*Graphics` 子 prop 做 **shallow-equal diff**。`Color`、`Cartesian2`、`Cartesian3`、`Material` 在 JSX 內 inline 建構 = 每次 render 新 reference = Resium 重建 entity = visible flicker。

**Why**：PR #88 反例 — `<PolylineGraphics material={Color.fromCssColorString("#fdcb6e")}>` 在 50ms playback `setInterval` 驅動下每秒新建 20 次 Color，黃色軌道 visible flashing。詳見 ADR-011 Appendix A（Appendix 撰寫時誤標為 "Chain #6"，實際應為 Chain #7；PR #89 修正）。

**How to apply**：
- **靜態視覺**：hoist 到 module scope。
```ts
const COLOR_POLYLINE = Color.fromCssColorString("#fdcb6e");
const PIXEL_OFFSET_LABEL = new Cartesian2(0, -18);
const NYCU_GS_POSITION = Cartesian3.fromDegrees(120.998, 24.787, 30);
```
- **動態視覺**（per-beam color 隨 SNR 變）：`useMemo` keyed on source array。
```ts
const stableCones = useMemo(
  () => beamCones.map((c) => ({
    materialColor: Color.fromCssColorString(c.color.hex).withAlpha(c.color.alpha),
    position: Cartesian3.fromDegrees(c.lon, c.lat, c.alt),
  })),
  [beamCones],
);
```

**Verify**：
```bash
grep -nE 'Color\.fromCssColorString|new Cartesian2|Cartesian3\.fromDegrees' \
  services/digital-twin-ui/src/pages/SatelliteView.tsx \
  | grep -E '<\w|return \(|<Viewer' || echo "OK: no inline Cesium constructions in JSX"
```
零命中 = pass。SPEC-S004-13e §AC-13e.8 codify 為 acceptance criterion（SPEC 內文寫 "Chain #6 (NEW)" 是 PR #88 落筆時的 off-by-one，實際對應本 chain 即 Chain #7；PR #89 修正）。

**現有 enforcement**：
- `vitest src/pages/SatelliteView.test.tsx` 7 panel render tests + 1 baseLayer prop assertion（PR #88）。
- 無 lint rule；可考慮 custom ESLint plugin 但目前只 SatelliteView 一頁，ROI 不值得。

---

## Chain #X — Process: 別追逐 moving-target visual bug

**這條不在 7 條 code chain 裡**，但 PR #88 學到必須 codify。

**規則**：修 visual bug 時**先寫測試 pin 住可見行為**，再改 code。不要 ship 8 commits 追同一個 moving target。

**Why**：PR #88 走過 10 commits / 6 類 fix（screen empty → stuck top-left → small canvas → render loop → flicker → 黃線閃）。沒有任何一個 commit 帶 regression test，所以下次同類 bug 在 CI 再來一次。

**How to apply**：
1. 進來看到 visual bug → **先**寫一個會 fail 的 test（panel render assertion / screenshot test / prop assertion）。
2. 再改 code 把 test 變綠。
3. 如果 bug 真的測不出來（pure visual 沒 prop / DOM 反應），在 PR body 寫一段 "Why this is untestable" 解釋並接受 reviewer 質疑。

**現有 enforcement**：CLAUDE.md §12.2 TDD red→green→refactor 已寫；PR template 沒強制；reviewer / `/review` skill 應檢查 visual fix PR 有沒有 regression test。

---

## Self-audit template (paste into PR body)

```markdown
### Anti-pattern self-audit (docs/reviews/anti-pattern-checklist.md)

- Chain #1 (grep-verify): <verify result or N/A — no claims about paths/lines>
- Chain #2 (POST-WRITE): <verify result or N/A — no Edit/Write>
- Chain #3 (cross-page alignment): <verify result or N/A — no shared concepts>
- Chain #4 (NaN guard): <verify result or N/A — no numeric paths>
- Chain #5 (first-call-only): <verify result or N/A — no init/lazy logic>
- Chain #6 (partial-migration): <verify result or N/A — no class-wide migration>
- Chain #7 (Resium reference-stability): <verify result or N/A — no Cesium/Resium changes>
- Chain #X (process): regression test exists / "untestable because <reason>"
```

---

## Case studies

### CS-1 — Recovery sessions (2026-05-08)

**Context.** 22-min pause between commit-staging (`git status` showed 6 RM + 1 M, no untracked) and the user returning to ask "ultrathink find me the latest state". User believed a separate Claude session might have been running concurrently. JSONL forensics confirmed it was the same session paused — no concurrent edits, working tree was the assistant's own staged-but-uncommitted recovery work for PR #91 review fix-pack. The session resumed: extracted the planned commit message verbatim from JSONL, ran `git add -A` + `git commit` + `git push`, CI green, PR #91 squash-merged → main `acb8340`.

**5 self-violations caught by deep self-/review afterward**:

| # | Violation | Chain | Why it slipped | Mitigation |
|---|---|---|---|---|
| 1 | AC-count regex `^### AC-S00[356]-VS\d+\.\d+` produced **0 ACs** for `AC-S006-VS21` because that file uses `A1..A8 + B1..B10` letter-prefixed numbering (design + impl split). Real count was 18 (8+10), claim was 18 — ground-truth correct, but verification regex too narrow. | #1 grep-verify, #2 POST-WRITE | Designed regex from a single-file mental model; didn't check the third file's actual numbering before reusing pattern. | Always read the actual document before crafting count regex. Prefer `grep -c '^### '` and visually compare per-file headers, OR include explicit OR alternation: `^### AC-S006-VS21\.([0-9]+\|[AB][0-9]+)`. |
| 2 | `originSessionId` field in memory file used JSONL UUID (`58a2f3fe-...`); earlier files use date-strings (`2026-05-07-harvest`). Mixed convention. | #3 cross-page alignment (memory-file convention) | No documented standard for this field; reused whatever was at hand. | Pick one convention, document in `docs/agile/sprint-NN-plan.md`-style template OR memory-file template. **Recommendation: date-string `YYYY-MM-DD-keyword`** — human-readable, sorts naturally, decoupled from session UUIDs that may rotate. |
| 3 | Squash-merge collapsed two branch commits (`555d099` initial draft + `7d08457` review fix-pack) into a single main commit `acb8340`. The `[skip-tdd]` fix-pack story now lives in PR #91 web page only — `git log` on main shows only the title of the first commit. Future bisect / `git log --grep "fix-pack"` returns nothing. | (informational, project convention) | Project convention IS squash; not strictly a violation. But `git log` reader loses context of "this PR had a deep-/review round + correction". | **Either** (a) accept the loss; (b) push merge commits when the fix-pack is non-trivial; (c) if squashing, edit the squash commit message to mention the fix-pack: "*Includes /review fix-pack — rename collision + 2 Chain #1 violations.*". Pick a project convention and document. |
| 4 | TaskCreate not used for the 7-step recovery (Discovery → Recovery commit → Push → CI wait → Merge → Sync → Memory write). Harness reminder fired ≥ 4 times during the session. | #X process | Steps were sequential, tight, and felt small individually. Underestimated total scope. | Rule of thumb: if the assistant is going to send ≥ 3 separate `Bash`/`Edit`/`Write` tool calls for one user request, open TaskCreate first. Reminder is a **guard rail**, not noise. |
| 5 | `verify.sh` ran **only post-commit**. Pre-commit verify skipped because the changes were "just renames + sed". | #X process | Risk-tolerance based on familiarity, not on policy. | `verify.sh` is cheap (≤ 30 s). Run pre-commit unconditionally for any `services/**` or `docs/specs/` / `docs/acceptance/` change. The only exception is one-line typo fixes. |

**Meta-finding.** Deep self-review caught (1) by re-running its own grep with broader pattern. The recovery process worked: Chain #1 + Chain #2 are recursively applicable to the assistant's own verification scripts, not just to source code. **Add this to mental model: when you write a verification grep, the grep itself can have Chain #1 violations.**

**Process gap exposed.** No project convention for memory file `originSessionId`, no convention for whether squash merges should annotate fix-packs in their commit message. CLAUDE.md §12.4 covers PR title format but not these details. Either tighten CLAUDE.md or accept the inconsistency.

### When to add a case study

A case study earns its slot when **all three** of:
1. The slip-up went past pre-merge gates (CI / `/review` / self-audit).
2. The root cause is a **gap in the chain definitions or process**, not contributor inattention.
3. Concrete mitigation can be written without re-litigating the original PR.

Otherwise, just fix the issue in a follow-up PR and move on. Avoid case-study inflation.
