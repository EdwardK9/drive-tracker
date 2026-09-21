# Stage 1: Build the client frontend
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# Use npm ci if package-lock.json exists, otherwise fallback to npm install
RUN if [ -f package-lock.json ]; then npm ci || npm install --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime dependencies for SQLite
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# Install production dependencies (tsx is in dependencies so production runtime has tsx)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev || npm install --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi

# Copy built frontend and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/metadata.json ./metadata.json

# Persistent directories
RUN mkdir -p /app/data /app/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV UPLOADS_DIR=/app/uploads

EXPOSE 3000

VOLUME ["/app/data", "/app/uploads"]

CMD ["npm", "run", "start"]
