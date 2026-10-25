# Build from the repository root so the workspace lockfile is part of the context:
#   docker build -f ha-finassists/Dockerfile -t ha-finassists .
# BuildKit picks up Dockerfile.dockerignore next to this file; patterns apply to
# that context.
FROM oven/bun:1.4.0-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
COPY ha-finassists/package.json ./ha-finassists/package.json
RUN bun install --frozen-lockfile
COPY ha-finassists/tsconfig.json ./ha-finassists/tsconfig.json
COPY ha-finassists/src ./ha-finassists/src
RUN cd ha-finassists && bun run build

FROM oven/bun:1.4.0-alpine

WORKDIR /app
COPY package.json bun.lock ./
COPY ha-finassists/package.json ./ha-finassists/package.json
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=build /app/ha-finassists/dist ./ha-finassists/dist
COPY ha-finassists/backup-pre.sh ./
COPY ha-finassists/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --from=build /app/ha-finassists/src/modules/storage/infrastructure/backup/backup-pre.ts ./backup-pre.ts
RUN apk add --no-cache su-exec \
	&& chmod +x ./backup-pre.sh /usr/local/bin/docker-entrypoint.sh \
	&& mkdir -p /data \
	&& chown bun:bun /data

ENV NODE_ENV=production
ENV PORT=8099
EXPOSE 8099

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "ha-finassists/dist/server.js"]
