# Dev image for the monorepo. Source is bind-mounted; node_modules live in
# named volumes (see docker-compose.yml), so the host never gets them.
FROM node:24-alpine

RUN npm install -g pnpm@10.34.6 \
 && apk add --no-cache libc6-compat openssl

# Named volumes copy ownership from the image on first use, so pre-create every
# node_modules mount point owned by `node` (uid 1000, same as the host user).
RUN mkdir -p /app/node_modules \
      /app/apps/web/node_modules /app/apps/admin/node_modules /app/apps/worker/node_modules \
      /app/packages/db/node_modules /app/packages/core/node_modules /app/packages/ui/node_modules \
      /app/apps/web/.next /app/apps/admin/.next /pnpm-store \
 && chown -R node:node /app /pnpm-store

USER node
WORKDIR /app
ENV PNPM_STORE_DIR=/pnpm-store \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1
