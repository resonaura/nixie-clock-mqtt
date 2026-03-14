# Global ARG must be declared before any FROM so it is visible in all stages.
# It is also re-declared inside stage 2 to bring it into that stage's scope.
ARG BUILD_FROM

# ── Stage 1: build ────────────────────────────────────────────────────────────
# Official Node.js alpine image — Node/npm already present, no apt dance needed.
FROM node:22-alpine AS builder

WORKDIR /build

# Copy manifests first — this layer is cached until deps actually change
COPY package.json package-lock.json ./

# Install ALL deps (devDependencies needed for tsc)
RUN npm ci --prefer-offline

# Copy source and tsconfig, then compile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# Drop devDependencies — only prod deps go into the runtime image
RUN npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# Re-declare ARG so its value is available in this stage's scope.
ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js via NodeSource — this layer is cached after the first build
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy only what runtime needs: compiled JS + production node_modules
COPY --from=builder /build/dist        ./dist
COPY --from=builder /build/node_modules ./node_modules

COPY addon.sh /addon.sh
RUN chmod +x /addon.sh

CMD ["/addon.sh"]
