# -------- Dependencies + Build (ULTRA FAST) --------
    FROM oven/bun:1.1.30 AS builder
    WORKDIR /app
    
    # Copy only what's needed first for cache
    COPY package.json bun.lockb ./
    RUN bun install --frozen-lockfile
    
    # Copy rest of the source
    COPY . .
    
    # Environment
    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1
    ENV NEXT_DEBUG=1
    ENV CI=1
    ENV NODE_OPTIONS="--max-old-space-size=4096"
    
    # Generate Prisma Client
    RUN bunx prisma generate
    
    # Build Next.js with Bun (super fast)
    RUN bun run build
    
    # -------- Runner (small, clean image) --------
    FROM node:20-bookworm-slim AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME="0.0.0.0"
    
    # Copy only what’s needed to run
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/prisma ./prisma
    
    USER node
    EXPOSE 3000
    CMD ["node", "server.js"]
    