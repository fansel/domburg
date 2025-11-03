# =========================================================
# 🚀 Ultra-Fast Next.js + Prisma Production Dockerfile
#   - Uses Bun (super fast) for build
#   - Works even without bun.lockb
#   - Produces small, clean final image
# =========================================================

# ---------- 1. Builder Stage ----------
    FROM oven/bun:1.1.30 AS builder
    WORKDIR /app
    

    RUN apt-get update -y && apt-get install -y openssl
    
    # Copy only package manifest first for caching
    COPY package.json ./
    # If you already have a bun.lockb locally, uncomment the next line:
    # COPY bun.lockb ./
    
    # Install dependencies with Bun (fastest)
    RUN bun install
    
    # Copy the rest of the source code
    COPY . .
    
    # Environment variables for optimized build
    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1
    ENV CI=1
    # Bun und Node.js Memory-Limits
    ENV NODE_OPTIONS="--max-old-space-size=6144"
    ENV BUN_JSC_memoryLimitMB=6144
    
    # Generate Prisma client (faster via bunx)
    RUN echo "=== Generating Prisma client ===" && \
        bunx prisma generate && \
        echo "=== Prisma client generated ==="
    
    # Build Next.js (ultra fast with Bun)
    # Nutze explizit node für den Build wenn Bun zu viel Memory braucht
    RUN echo "=== Starting Next.js build ===" && \
        NODE_OPTIONS="--max-old-space-size=6144" bun run build || \
        (echo "=== Bun build failed, trying with node ===" && \
         NODE_OPTIONS="--max-old-space-size=6144" npm run build) && \
        echo "=== Build completed successfully ==="
    
    # ---------- 2. Runner Stage ----------
    FROM node:20-bookworm-slim AS runner
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME="0.0.0.0"
    
    # Install OpenSSL for Prisma (required at runtime)
    RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
    
    # Install tsx globally for running seed scripts (as root, before switching to node user)
    RUN npm install -g tsx
    
    # Copy only what's needed for runtime with correct ownership
    COPY --chown=node:node --from=builder /app/.next/standalone ./
    COPY --chown=node:node --from=builder /app/.next/static ./.next/static
    COPY --chown=node:node --from=builder /app/public ./public
    COPY --chown=node:node --from=builder /app/prisma ./prisma
    # Copy template directory for seed script
    COPY --chown=node:node --from=builder /app/src/template ./src/template
    # Copy node_modules for seed script (bcryptjs, @prisma/client, etc.)
    COPY --chown=node:node --from=builder /app/node_modules ./node_modules
    # Copy package.json and tsconfig.json for proper module resolution with tsx
    COPY --chown=node:node --from=builder /app/package.json ./package.json
    COPY --chown=node:node --from=builder /app/tsconfig.json ./tsconfig.json
    
    # Run as non-root user for safety
    USER node
    
    EXPOSE 3000
    CMD ["node", "server.js"]
    