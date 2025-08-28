# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production --no-optional && npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - minimal Alpine with Node.js and curl
FROM alpine:3.22

# Install only Node.js (current v20), npm (for deps) and curl
RUN apk add --no-cache nodejs npm curl

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install only the native production dependencies that can't be bundled
# yaml is bundled, so we only need sqlite3 and ldapts
RUN npm install --production --no-optional sqlite3 ldapts && \
    npm cache clean --force && \
    rm -rf /root/.npm

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (adapter-node defaults to 9093)
EXPOSE 9093

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=9093
ENV HOST=0.0.0.0

# Health check using curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9093/ || exit 1

# Start the application
CMD ["node", "build"]