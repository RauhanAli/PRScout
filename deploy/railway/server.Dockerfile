# PRScout API server for Railway: deploy/server/Dockerfile without BuildKit
# cache mounts, which Railway's builder only accepts with its own service-id
# prefix. Same image otherwise. Build context: the repository root; the files
# it reads are the `!` lines of server.Dockerfile.dockerignore beside it.
# Railway runs it from /railway.json; see deploy/railway/README.md.
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_NO_CACHE=1
WORKDIR /app

COPY pyproject.toml uv.lock README.md LICENSE NOTICE ./
COPY server/pyproject.toml server/pyproject.toml
RUN uv sync --frozen --no-dev --package prscout-server --no-install-workspace

COPY src/ src/
COPY server/ server/
RUN uv sync --frozen --no-dev --package prscout-server --no-editable

FROM python:3.12-slim
RUN useradd --create-home --uid 10001 prscout
COPY --from=build /app/.venv /app/.venv
# Railway sets PORT; the server listens on it (prscout_server.main.run).
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 HOST=0.0.0.0 PORT=8000
USER prscout
WORKDIR /home/prscout
EXPOSE 8000
CMD ["prscout-server"]
