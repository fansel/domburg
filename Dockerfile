# Dockerfile für Production Deployment
# 
# ALTERNATIVE: Für schnelleres Iterieren kannst du lokal bauen und Dockerfile.local verwenden:
#   1. npm run build (lokal)
#   2. docker build -f Dockerfile.local -t domburg-app .
#
# Dieses Dockerfile baut alles innerhalb von Docker (langsamer, aber reproduzierbar)
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
# Docker kann den Output verzögert anzeigen, auch wenn der Build läuft
RUN echo "=== Starting Next.js build process (this may take 5-15 minutes) ===" && \
    echo "=== Build started at: $(date) ===" && \
    NODE_OPTIONS="--max-old-space-size=4096" npm run build && \
    echo "=== Build completed at: $(date) ===" && \
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

# Installiere tsx und prisma global für Scripts (vor USER nextjs für Berechtigung)
RUN npm install -g tsx prisma

# Kopiere prisma Verzeichnis für Migrationen und Seeding
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Kopiere src/template Verzeichnis für email-templates-seed.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/template ./src/template

# Kopiere tsconfig.json für TypeScript-Pfad-Auflösung
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Kopiere package.json für npm scripts
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Kopiere Entrypoint-Script
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]

