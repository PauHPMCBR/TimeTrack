# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Copy workspace sources needed for the build
COPY shared ./shared
COPY frontend ./frontend

# Optional per-company branding (see branding/README.md). The folder is always
# copied; icon.png / favicon.png inside it override the defaults if present.
COPY branding ./branding

RUN npm ci

ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# NEXT_PUBLIC_APP_NAME: text name (login page, header, browser tab).
ARG NEXT_PUBLIC_APP_NAME=TimeTrack360
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
# NEXT_PUBLIC_* URL vars stay empty (=> stock branding) unless branding files
# are provided; they are set in the build step below via brand.env.
ENV NEXT_PUBLIC_APP_ICON_URL=
ENV NEXT_PUBLIC_FAVICON_URL=

WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1

# Copy branding files into public/ and record the baked local paths in
# /app/brand.env, which is sourced before `next build` (so Next inlines them).
RUN mkdir -p public/brand && rm -f /app/brand.env && { \
      if [ -f /app/branding/icon.png ]; then \
        cp /app/branding/icon.png public/brand/icon.png && \
        echo "NEXT_PUBLIC_APP_ICON_URL=/brand/icon.png" >> /app/brand.env; \
      fi; \
      if [ -f /app/branding/favicon.png ]; then \
        cp /app/branding/favicon.png public/brand/favicon.png && \
        echo "NEXT_PUBLIC_FAVICON_URL=/brand/favicon.png" >> /app/brand.env; \
      fi; \
    }

RUN set -a; [ -f /app/brand.env ] && . /app/brand.env || true; set +a; npm run build

# Stage 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S web -u 1001 -G appgroup

COPY --from=builder --chown=web:appgroup /app/frontend/.next /app/frontend/.next
COPY --from=builder --chown=web:appgroup /app/frontend/public /app/frontend/public
COPY --from=builder /app/frontend/package.json /app/frontend/package.json
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
COPY --from=builder /app/shared/src /app/shared/src
COPY --from=builder /app/shared/package.json /app/shared/package.json

# Install production dependencies only
WORKDIR /app
RUN npm ci --omit=dev && npm cache clean --force

WORKDIR /app/frontend
USER web

EXPOSE 3000

CMD ["npm", "start"]
