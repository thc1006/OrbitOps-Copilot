# Build context is the repo root (see deploy/docker-compose.yml: `context: ..`).
# This is required because the emulator reads tests/contracts/scenario.schema.json
# at startup, and that path lives outside any single service tree.
FROM python:3.13-slim

WORKDIR /app

COPY services/ntn-metrics-emulator/pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir 'fastapi>=0.115' 'uvicorn[standard]>=0.32' \
                                'pydantic>=2.0' 'jsonschema>=4.0' \
                                'prometheus-client>=0.21'

COPY services/ntn-metrics-emulator/src/ ./src/
COPY tests/contracts /app/tests/contracts

ENV PYTHONPATH=/app/src
EXPOSE 8000

CMD ["uvicorn", "ntn_metrics_emulator.main:app", "--host", "0.0.0.0", "--port", "8000"]
