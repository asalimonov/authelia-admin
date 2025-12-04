FROM node:25-alpine

# Install build dependencies for native modules (sqlite3, ldapts)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install ALL dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci

# Image is ready for:
# - npm run build (compile production app)
# - npm run lint (ESLint)
# - npm test (unit tests)
# - npm run test:functional (functional tests)
# - npm run check (TypeScript check)
