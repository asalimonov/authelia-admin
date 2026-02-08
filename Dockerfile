FROM node:25-slim AS builder

# Install build dependencies for native modules (sqlite3, ldapts)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production dependencies stage - use debian-slim for native module compilation
FROM node:25-slim AS prod-deps

# Install build dependencies for native modules (sqlite3, ldapts)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force && \
    rm -rf /root/.npm

# Production stage - minimal Alpine with Node.js (no compilation needed here)
FROM alpine:3.23

RUN apk add --no-cache nodejs curl
WORKDIR /app

ENV NODE_ENV=production HOST=0.0.0.0 PORT=9093

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built app from builder, production deps from prod-deps stage
COPY --chown=1001:1001 --from=builder /app/build ./build
COPY --chown=1001:1001 --from=prod-deps /app/node_modules ./node_modules
COPY --chown=1001:1001 --from=builder /app/package.json ./

USER nodejs

EXPOSE 9093
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9093/auth-admin/health || exit 1

CMD ["node", "build"]
