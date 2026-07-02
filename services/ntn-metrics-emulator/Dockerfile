# Build context is the repo root (see deploy/docker-compose.yml: `context: ..`).
# This is required because the emulator reads tests/contracts/scenario.schema.json
# at startup, and that path lives outside any single service tree.
FROM docker.io/library/python:3.13-slim

WORKDIR /app

# Install FROM pyproject.toml (single source of truth for deps). A prior
# hand-typed pip list drifted — jsonschema lived only here, not in pyproject,
# so a clean `pip install` (e.g. the CI perf-smoke job) crashed uvicorn on
# startup. Installing the package itself prevents that class of drift.
COPY services/ntn-metrics-emulator/pyproject.toml ./
COPY services/ntn-metrics-emulator/src/ ./src/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

COPY tests/contracts /app/tests/contracts

ENV PYTHONPATH=/app/src
EXPOSE 8000

CMD ["uvicorn", "ntn_metrics_emulator.main:app", "--host", "0.0.0.0", "--port", "8000"]
