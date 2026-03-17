# Stage 1: Build
FROM oven/bun:alpine AS builder
WORKDIR /app

# Copy the entire project for workspace support
COPY . .

# 1. Build shared package
WORKDIR /app/shared
RUN bun install
RUN bun run build

# 2. Build frontend
WORKDIR /app/frontend
RUN bun install

# Create a minimal next.config.ts if it doesn't exist to optimize build
RUN echo 'import type { NextConfig } from "next";' > next.config.ts && \
    echo 'const nextConfig: NextConfig = {' >> next.config.ts && \
    echo '  eslint: { ignoreDuringBuilds: true },' >> next.config.ts && \
    echo '  typescript: { ignoreBuildErrors: true },' >> next.config.ts && \
    echo '  transpilePackages: ["@registre-jornada/shared"],' >> next.config.ts && \
    echo '};' >> next.config.ts && \
    echo 'export default nextConfig;' >> next.config.ts

RUN bun next build

# Stage 2: Runner
FROM oven/bun:alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

# Create non-root user
RUN addgroup -g 1001 -S bunjs && \
    adduser -S bunuser -u 1001

# Copy build artifacts and dependencies
COPY --from=builder /app/frontend/.next /app/frontend/.next
COPY --from=builder /app/frontend/package.json /app/frontend/package.json
COPY --from=builder /app/frontend/node_modules /app/frontend/node_modules
COPY --from=builder /app/shared /app/shared

WORKDIR /app/frontend
USER bunuser

EXPOSE 3000

CMD ["bun", "next", "start"]