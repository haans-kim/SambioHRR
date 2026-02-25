# Stage 1: Build
FROM node:20-alpine AS builder

# Build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

COPY . .

# Exclude DB file from build context (should be in .dockerignore)
# Build Next.js (uses in-memory DB at build time)
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner

RUN apk add --no-cache python3 make g++

WORKDIR /app

ENV NODE_ENV=production

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./

# Install production dependencies only (rebuilds native modules for linux)
RUN npm ci --omit=dev

# DB는 Volume으로 마운트됨 (DB_PATH 환경변수로 경로 지정)
# 기본값: /data/sambio_human.db
ENV DB_PATH=/data/sambio_human.db

EXPOSE 4000

CMD ["npm", "start"]
