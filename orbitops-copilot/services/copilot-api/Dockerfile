FROM python:3.13-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir 'fastapi>=0.115' 'uvicorn[standard]>=0.32' \
                                'pydantic>=2.0' 'httpx>=0.27' \
                                'prometheus-client>=0.21'

COPY src/ ./src/

ENV PYTHONPATH=/app/src
EXPOSE 8001

CMD ["uvicorn", "copilot_api.main:app", "--host", "0.0.0.0", "--port", "8001"]
