FROM oven/bun:alpine
WORKDIR /app

COPY . .

WORKDIR /app/backend
ENV NEXT_TELEMETRY_DISABLED 1

RUN apk add --no-cache libc6-compat

RUN bun install

RUN echo 'import type { NextConfig } from "next";' > next.config.ts
RUN echo '' >> next.config.ts
RUN echo 'const nextConfig: NextConfig = {' >> next.config.ts
RUN echo '  eslint: { ignoreDuringBuilds: true },' >> next.config.ts
RUN echo '  typescript: { ignoreBuildErrors: true },' >> next.config.ts
RUN echo '  transpilePackages: ["@registre-jornada/shared"],' >> next.config.ts
RUN echo '};' >> next.config.ts
RUN echo '' >> next.config.ts
RUN echo 'export default nextConfig;' >> next.config.ts

RUN bun next build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup -g 1001 -S bunjs
RUN adduser -S api -u 1001

USER api

EXPOSE 3001
ENV PORT 3001

CMD ["sh", "-c", "NODE_ENV=production bun next start -p 3001"]