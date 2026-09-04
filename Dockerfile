# Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /build

COPY app/package.json app/package-lock.json ./
RUN npm ci --prefer-offline

COPY app/tsconfig.json app/tsconfig.build.json ./
COPY app/src ./src

RUN npm run build
RUN npm prune --omit=dev

# Stage 2: runtime
FROM node:22-slim

WORKDIR /usr/src/app

COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
