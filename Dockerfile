# =========================================================
# 🚀 Next.js + Prisma Production Dockerfile (cache-optimized)
# =========================================================

# ---------- 1. Builder Stage ----------
    FROM node:20-bookworm AS builder
    WORKDIR /app
    
    # Enable BuildKit inline caching
    ARG BUILDKIT_INLINE_CACHE=1
    
    # Install OpenSSL (required by Prisma)
    RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
    
    # Copy only package manifests first for caching
    COPY package.json package-lock.json* ./
    
    # Install all dependencies efficiently with BuildKit cache mount
    # Caches npm packages between builds to avoid re-downloading
    # The cache is automatically invalidated when package-lock.json changes
    # because the COPY layer above will be invalidated, forcing npm ci to re-run
    RUN --mount=type=cache,target=/root/.npm \
        npm ci --no-audit --no-fund --progress=false
    
    # Copy the rest of the project
    COPY . .
    
    # Environment variables for build
    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1
    ENV CI=1
    ENV NODE_OPTIONS="--max-old-space-size=6144"
    
    # Generate Prisma client
    RUN echo "=== Generating Prisma client ===" && \
        npx prisma generate && \
        echo "=== Prisma client generated ==="
    
    # Build Next.js
    RUN echo "=== Starting Next.js build ===" && \
        npm run build && \
        echo "=== Build completed successfully ==="
    
    # ---------- 2. Runner Stage ----------
    FROM node:20-bookworm-slim AS runner
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOSTNAME="0.0.0.0"
    
    # Install OpenSSL for Prisma at runtime
    RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
    
    # Install tsx globally (for seed scripts)
    RUN npm install -g tsx
    
    # Copy runtime assets
    COPY --chown=node:node --from=builder /app/.next/standalone ./
    COPY --chown=node:node --from=builder /app/.next/static ./.next/static
    COPY --chown=node:node --from=builder /app/public ./public
    COPY --chown=node:node --from=builder /app/prisma ./prisma
    COPY --chown=node:node --from=builder /app/src/template ./src/template
    COPY --chown=node:node --from=builder /app/scripts ./scripts
    COPY --chown=node:node --from=builder /app/node_modules ./node_modules
    COPY --chown=node:node --from=builder /app/package.json ./package.json
    COPY --chown=node:node --from=builder /app/tsconfig.json ./tsconfig.json
    
    USER node
    
    EXPOSE 3000
    CMD ["node", "server.js"]
    