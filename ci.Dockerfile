FROM node:25-slim

# Install build dependencies for native modules (sqlite3, ldapts)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate .svelte-kit directory (required for tests)
RUN npx svelte-kit sync

# Image is ready for:
# - npm run build (compile production app)
# - npm run lint (ESLint)
# - npm test (unit tests)
# - npm run test:functional (functional tests)
# - npm run check (TypeScript check)
