# Dockerfile für Production Deployment
FROM node:18-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Generate first
RUN echo "=== Generating Prisma client ===" && \
    npx prisma generate && \
    echo "=== Prisma client generated ==="

# Build with verbose output and no telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_DEBUG=1

# Build with verbose output
# Note: Next.js build can take 5-15 minutes for large projects - this is NORMAL
# The build process compiles TypeScript, optimizes images, bundles code, etc.
RUN echo "=== Starting Next.js build process (this may take 5-15 minutes) ===" && \
    NODE_OPTIONS="--max-old-space-size=4096" npm run build && \
    echo "=== Next.js build completed successfully ===" && \
    echo "=== Checking build output ===" && \
    ls -lah .next/ 2>/dev/null && \
    ls -lah .next/standalone 2>/dev/null || echo "=== WARNING: standalone directory not found ==="

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]

