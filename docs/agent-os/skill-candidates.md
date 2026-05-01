# Skill candidates (uncertain — not yet promoted)

> Skills considered but **not** built into `.claude/skills/` because the workflow is not yet load-bearing in this repo. Promote with an ADR when usage is demonstrated 3+ times.

## Candidates

### sionna-rt-channel-bake (P2)

- **Idea**: Take a scenario JSON, render Sionna RT scene, bake channel coefficients, write back to emulator.
- **Why deferred**: P2 only; depends on Sionna RT + GPU runtime; AODT OSS still needs verification.
- **Promote when**: a real Sionna RT pipeline is wired in `services/` and used twice.

### nephio-package-publish (P2)

- **Idea**: Validate `packages/nephio-stubs/` with `kpt fn render` and publish to a package registry.
- **Why deferred**: ADR-005 keeps Nephio at stub-level; no real Porch in MVP.
- **Promote when**: management cluster lands and we routinely publish packages.

### prompt-eval-harness (P1?)

- **Idea**: Re-run Copilot LLM tests across providers (Ollama, vLLM, OpenAI) and compare grounding scores.
- **Why deferred**: only one provider used in P0; LLM-grounding-review covers single-provider already.
- **Promote when**: multi-provider comparison becomes a recurring task.

### tdx-tle-fetcher (P2)

- **Idea**: Pull current TLE for the eventual B5G satellite once launched and feed into scenario-generator.
- **Why deferred**: 1A launches ~2027; TLE not available; emulator uses stub orbits today.
- **Promote when**: real TLE source becomes available **and** is referenced by ≥ 3 scenarios.

### voice-asr-fallback (P1?)

- **Idea**: Whisper ↔ faster-whisper ↔ Canary-Qwen fallback chain for the demo voice path.
- **Why deferred**: voice is optional in MVP; Sprint 2 task S2-07 may make it primary.
- **Promote when**: voice path becomes part of the main demo and falls back across providers.

### sprint-retro-summarizer

- **Idea**: Generate sprint review markdown from `git log` + closed backlog items.
- **Why deferred**: small project; manual sprint review is fine.
- **Promote when**: backlog throughput exceeds ~15 items per sprint.

### ci-flake-triage

- **Idea**: When CI flakes, classify failure (real / flake / env) and re-run automatically up to N times.
- **Why deferred**: CI is small; no flakes seen yet.
- **Promote when**: ≥ 3 CI flakes observed in two consecutive sprints.

## Promotion rule

A candidate becomes a real skill in `.claude/skills/` only after:

1. Three uses of the workflow in this repo within a 30-day window, **or**
2. An explicit ADR proposing the skill, with consequences and alternatives.

This prevents skill sprawl and keeps `.claude/skills/` lean and load-bearing.
