# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS migrator
COPY . .
CMD ["npm", "run", "db:migrate"]

FROM dependencies AS builder
COPY . .

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Build-only values keep configuration modules importable during compilation.
# Docker Compose supplies the actual values at runtime.
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/tepatwaktu
ENV BETTER_AUTH_SECRET=tepatwaktu-build-only-secret-minimum-32-characters
ENV BETTER_AUTH_URL=http://localhost:3000
ENV OBJECT_STORAGE_ENDPOINT=http://object-storage:8333
ENV OBJECT_STORAGE_REGION=us-east-1
ENV OBJECT_STORAGE_BUCKET=tepatwaktu-private
ENV OBJECT_STORAGE_ACCESS_KEY=tepatwaktu-local
ENV OBJECT_STORAGE_SECRET_KEY=tepatwaktu-local-storage-secret
ENV OBJECT_STORAGE_FORCE_PATH_STYLE=true
ENV OBJECT_STORAGE_AUTO_CREATE_BUCKET=true

RUN mkdir -p public && npm run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=25s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000').then((r)=>process.exit(r.status < 500 ? 0 : 1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
