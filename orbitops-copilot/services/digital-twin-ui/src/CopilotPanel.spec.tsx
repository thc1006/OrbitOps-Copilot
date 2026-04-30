// TDD red-phase placeholders for SPEC-004 (digital-twin-ui).
//
// Sprint 1 (S1-06) will:
//   1. Build <CopilotPanel /> that posts to /ask and renders the
//      evidence block.
//   2. Replace each `test.todo` below with a real failing test
//      (the red commit), then implement until green.
//
// `test.todo` shows up in vitest output as TODO without failing,
// keeping CI green during Sprint 0 while documenting intent.
//
// Reference:
//   - docs/specs/SPEC-004-digital-twin-ui.md
//   - docs/acceptance/AC-001 / AC-002 .md
import { test } from "vitest";

test.todo(
  "SPEC-004: <CopilotPanel /> posts user question to /ask and renders the answer string",
);
test.todo(
  "SPEC-004: <CopilotPanel /> shows the evidence.metrics_used JSON viewer when status === 'ok'",
);
test.todo(
  "SPEC-004: <CopilotPanel /> shows INSUFFICIENT_EVIDENCE banner when status !== 'ok'",
);
test.todo(
  "SPEC-004: <RunbookView /> renders 5 collapsible steps in order (What/Why/Action/Risk/Next)",
);
