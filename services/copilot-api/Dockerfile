# Build context = repo root (matches deploy/docker-compose.yml `context: ..`
# and scripts/k8s-up-local.sh which runs `podman/docker build -f <Dockerfile> .`
# from the repo root).
FROM docker.io/library/python:3.13-slim

WORKDIR /app

# Install FROM pyproject.toml so the image's dependency set is a single source
# of truth. A prior hand-typed pip list drifted from pyproject and shipped an
# image missing PyJWT (crash on `import jwt`); installing the package itself
# root-causes that class of bug so it cannot recur on the next dep addition.
COPY services/copilot-api/pyproject.toml ./
COPY services/copilot-api/src/ ./src/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

ENV PYTHONPATH=/app/src
EXPOSE 8001

CMD ["uvicorn", "copilot_api.main:app", "--host", "0.0.0.0", "--port", "8001"]
