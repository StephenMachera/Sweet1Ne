# Multi-stage: dependencies are built once and copied in, so the final image
# carries no compilers or build headers it doesn't need at runtime.
FROM python:3.12-slim AS builder

# Stops Python writing .pyc files and buffering output — the second matters
# in containers, where buffered logs appear minutes late or not at all.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# psycopg2 compiles against libpq, and Pillow needs jpeg and zlib headers.
# All build-time only — none of this reaches the final image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Copied on its own so Docker caches the install layer — changing app code
# doesn't trigger a full reinstall.
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# --- Runtime -----------------------------------------------------------

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/usr/local/bin:$PATH"

WORKDIR /app

# Only the runtime libraries, not the headers they were compiled against.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libjpeg62-turbo \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

# A non-root user. If the app is ever compromised, the attacker lands as
# someone with no privileges rather than as root inside the container.
RUN useradd --create-home --shell /bin/bash sweet1ne

COPY --chown=sweet1ne:sweet1ne . .

USER sweet1ne

EXPOSE 8000

# Lets Docker and nginx know whether the app is actually serving, rather
# than just running.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Four workers suits a 2-vCPU box. More would just contend for the same
# cores; fewer would leave capacity unused.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]