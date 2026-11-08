# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS migrator
COPY . .
# After migrating, create the first superadmin when SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD are set and none exists yet.
CMD ["sh", "-c", "npm run db:migrate && node scripts/create-superadmin.mjs --if-none"]

# Runtime-only dependencies for the startup tasks in the runner (migrations, first superadmin).
FROM base AS ops
WORKDIR /ops
COPY scripts/ops/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

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

# Startup tasks, so a plain "Dockerfile" deployment (e.g. Coolify Dockerfile build pack) migrates on its own:
# apply pending migrations, create the first superadmin from SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD when none
# exists, then start the server. A failed migration stops the container. RUN_MIGRATIONS=off skips migrations.
COPY --from=ops --chown=nextjs:nodejs /ops/node_modules ./ops/node_modules
COPY --chown=nextjs:nodejs drizzle ./ops/drizzle
COPY --chown=nextjs:nodejs scripts/ops/migrate.mjs scripts/create-superadmin.mjs ./ops/

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000').then((r)=>process.exit(r.status < 500 ? 0 : 1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node ops/migrate.mjs && node ops/create-superadmin.mjs --if-none && exec node server.js"]
