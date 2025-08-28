# Development Dockerfile - mounts current directory as volume
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Expose development server port (using same port as production for consistency)
EXPOSE 9093

# Set environment for development
ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=9093
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Start development server
# The current directory should be mounted as a volume at /app
# Dependencies will be installed when container starts if not present
CMD ["sh", "-c", "[ ! -d node_modules ] && npm install || true; npm run dev -- --host 0.0.0.0 --port 9093"]