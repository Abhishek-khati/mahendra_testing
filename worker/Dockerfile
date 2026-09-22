# ── Stage 1: Node build ────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

# Install dependencies (only what's needed to build)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Copy source and compile the worker server
COPY tsconfig.json tsconfig.node.json ./
COPY server ./server
COPY shared ./shared
COPY worker ./worker
COPY patches ./patches

# Build worker/server.ts -> dist/worker-server.js
RUN pnpm exec esbuild worker/server.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outfile=dist/worker-server.js

# ── Stage 2: Runtime image with Python + Slither + solc ───────────────────────
FROM python:3.12-slim AS runtime

# Install Node.js 22 (needed to run the compiled worker server)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install solc-select + Slither
RUN pip install --no-cache-dir solc-select slither-analyzer

# Install common solc versions with 0.8.20 as standard default
RUN solc-select install 0.8.20 && \
    solc-select install 0.8.24 && \
    solc-select install 0.8.28 && \
    solc-select install latest && \
    solc-select use 0.8.20

# Create non-root user
RUN useradd --create-home --shell /usr/sbin/nologin worker

WORKDIR /app

# Copy built worker from build stage
COPY --from=build /app/dist/worker-server.js ./

# Copy only production node_modules we need (express is the only runtime dep)
COPY --from=build /app/node_modules ./node_modules

# Ensure solc-select binaries are on PATH for the worker user
ENV PATH="/root/.local/bin:/root/.solc-select/artifacts:${PATH}"

USER worker

EXPOSE 4000

CMD ["node", "worker-server.js"]
