# Build context = repo root (matches deploy/docker-compose.yml `context: ..`
# and scripts/k8s-up-local.sh which runs `podman/docker build -f <Dockerfile> .`
# from the repo root).
FROM docker.io/library/python:3.13-slim

WORKDIR /app

COPY services/copilot-api/pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir 'fastapi>=0.115' 'uvicorn[standard]>=0.32' \
                                'pydantic>=2.0' 'httpx>=0.27' \
                                'prometheus-client>=0.21' \
                                'prometheus-fastapi-instrumentator>=7.0,<8.0' \
                                'PyJWT[crypto]>=2.12.1'

COPY services/copilot-api/src/ ./src/

ENV PYTHONPATH=/app/src
EXPOSE 8001

CMD ["uvicorn", "copilot_api.main:app", "--host", "0.0.0.0", "--port", "8001"]
