FROM node:25-alpine

WORKDIR /app

EXPOSE 9093

ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=9093
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Start development server
# The current directory should be mounted as a volume at /app
# Dependencies will be installed when container starts if not present
CMD ["sh", "-c", "npm install && npm rebuild && npm run dev -- --host 0.0.0.0 --port 9093"]