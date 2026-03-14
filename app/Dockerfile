# ── Stage 1: build ────────────────────────────────────────────────────────────
# Use the official Node.js alpine image — has npm/node already, no apt dance.
FROM node:22-alpine AS builder

WORKDIR /build

# Copy manifests first so this layer is cached unless deps change
COPY package.json package-lock.json ./

# Install ALL deps (including devDependencies needed for tsc)
RUN npm ci --prefer-offline

# Copy source and compile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# Prune to production-only node_modules
RUN npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# Use the HA base image so the supervisor / s6-overlay / bashio are present.
ARG BUILD_FROM
FROM $BUILD_FROM

# Node.js from the NodeSource binary — much faster than compiling,
# but we only need it once at layer-build time and it gets cached.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy only what the runtime needs: compiled JS + prod node_modules
COPY --from=builder /build/dist        ./dist
COPY --from=builder /build/node_modules ./node_modules

COPY addon.sh /addon.sh
RUN chmod +x /addon.sh

CMD ["/addon.sh"]
