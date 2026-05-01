# OrbitOps Copilot — Makefile
# All targets idempotent; long-form flags; no destructive defaults.

SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

ROOT := $(shell pwd)
VENV := .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip

# ---------- Help ----------
.PHONY: help
help:
	@awk 'BEGIN {FS = ":.*##"; printf "Targets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ {printf "  \033[36m%-26s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------- Bootstrap ----------
.PHONY: bootstrap
bootstrap: ## Create venv + install Python tooling + Node deps (placeholder for now)
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install ruff pytest jsonschema pyyaml
	@echo "[bootstrap] Python venv ready at $(VENV)"
	@echo "[bootstrap] Node deps will be installed by service-level make targets in Sprint 1+."

.PHONY: install-deps
install-deps: bootstrap ## Per-service deps (placeholder until Sprint 1 services land)
	@echo "[install-deps] services unimplemented in Sprint 0; targets activate in Sprint 1."

# ---------- Quality gates ----------
.PHONY: lint
lint: ## ruff (Python) + ESLint (TS) placeholders
	@if [ -x "$(PY)" ]; then \
	  $(VENV)/bin/ruff check services/ scripts/ tests/ --no-cache || true; \
	else \
	  echo "[lint] venv not found; run 'make bootstrap' first."; \
	fi
	@echo "[lint] ESLint will be wired when digital-twin-ui ships in Sprint 1."

.PHONY: typecheck
typecheck: ## tsc -b (frontend) + mypy (optional)
	@echo "[typecheck] tsc -b placeholder until Sprint 1 UI lands."
	@echo "[typecheck] mypy optional; run separately if needed."

.PHONY: test
test: ## pytest + vitest (delegates to ./test.sh which is graceful about missing tests)
	./test.sh

.PHONY: verify
verify: ## Full local CI: lint + schema + secrets + manifest validate
	./verify.sh

# ---------- Dev ----------
.PHONY: dev-up
dev-up: ## docker compose up (services + obs stack)
	docker compose -f deploy/docker-compose.yml up -d --remove-orphans

.PHONY: dev-down
dev-down: ## docker compose down
	docker compose -f deploy/docker-compose.yml down --remove-orphans

.PHONY: demo
demo: ## End-to-end golden demo (requires dev-up first)
	scripts/run-demo.sh

# ---------- K8s ----------
.PHONY: k8s-up
k8s-up: ## Full local k8s deploy (containerd kubeadm; uses sudo for ctr import)
	scripts/k8s-up-local.sh

.PHONY: k8s-up-kind
k8s-up-kind: ## Alternate path for kind-based clusters (no sudo / ctr)
	scripts/k8s-up.sh

.PHONY: k8s-down
k8s-down: ## Tear down orbitops namespace (does NOT touch the cluster itself)
	scripts/k8s-down.sh

.PHONY: kind-up
kind-up: ## Create local kind cluster (used by k8s-up-kind)
	kind create cluster --name orbitops --config deploy/kind/cluster.yaml

.PHONY: kind-down
kind-down: ## Destroy local kind cluster
	kind delete cluster --name orbitops

.PHONY: k8s-apply
k8s-apply: ## Dry-run apply Kustomize overlay (validation only; no cluster contact)
	kustomize build --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/local | kubeconform -strict -summary -

.PHONY: k8s-smoke
k8s-smoke: ## Run scripts/k8s-smoke-test.sh (static; --live for cluster checks)
	scripts/k8s-smoke-test.sh

.PHONY: k8s-reload-observability
k8s-reload-observability: ## Re-apply Kustomize overlay + restart Grafana/Prometheus (use after observability/** changes)
	# VS-7. Driver: PR #34 elevation panel landed in git but live cluster ran
	# the pre-PR-#34 ConfigMap because no `kubectl apply` ran post-merge —
	# Grafana provisioning's `updateIntervalSeconds=30` only re-reads when
	# the ConfigMap changes, and the ConfigMap doesn't change without apply.
	# This target closes that loop. Idempotent. Requires kubeconfig pointing
	# at the target cluster.
	kustomize build --load-restrictor=LoadRestrictionsNone deploy/k8s/overlays/local | kubectl apply -f -
	kubectl -n orbitops rollout restart deployment/grafana deployment/prometheus
	kubectl -n orbitops rollout status deployment/grafana --timeout=90s
	kubectl -n orbitops rollout status deployment/prometheus --timeout=90s

# ---------- Schema / contracts ----------
.PHONY: schema-check
schema-check: ## Validate sample scenarios against scenario.schema.json
	$(PY) scripts/validate_schemas.py

# ---------- Packaging ----------
# Note: a custom zip script is no longer maintained — `git archive` does the
# same thing in one line, with content sourced from git itself (no .git/,
# no venv, no caches; only tracked files).
#
# RunSpace reviewers can also use GitHub's "Code → Download ZIP" button on
# the repo page; this `archive` target is for offline / scripted use only.
.PHONY: archive
archive: ## Produce orbitops-copilot.zip via git archive (RunSpace deliverable)
	git archive --format=zip --prefix=orbitops-copilot/ HEAD -o orbitops-copilot.zip
	@du -h orbitops-copilot.zip

# ---------- Cleaning ----------
.PHONY: clean
clean: ## Clean venv + caches (does NOT touch git)
	rm -rf $(VENV) .pytest_cache .ruff_cache __pycache__ tmp/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@echo "[clean] done."
