# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Install dependencies before copying sources so the expensive `npm ci` layer is
# cached across deploys (it only reruns when the manifests change). The cache
# mount persists the npm cache between builds, avoiding re-downloads.
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy workspace sources needed for the build
COPY shared ./shared
COPY backend ./backend

WORKDIR /app/backend
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S api -u 1001 -G appgroup

# Per-company runtime data directory (mounted from the host in production).
RUN mkdir -p /data && chown api:appgroup /data

COPY --from=builder --chown=api:appgroup /app/backend/.next /app/backend/.next
COPY --from=builder /app/backend/package.json /app/backend/package.json
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
COPY --from=builder /app/shared/src /app/shared/src
COPY --from=builder /app/shared/package.json /app/shared/package.json

# Install production dependencies only
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

WORKDIR /app/backend
USER api

EXPOSE 3001

CMD ["npm", "start"]
