FROM oven/bun:1.4.4-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY tsconfig.json ./
RUN bun run build

FROM oven/bun:1.4.4-alpine

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=build /app/dist ./dist
COPY backup-pre.sh ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --from=build /app/src/modules/storage/infrastructure/backup/backup-pre.ts ./backup-pre.ts
RUN apk add --no-cache su-exec \
	&& chmod +x ./backup-pre.sh /usr/local/bin/docker-entrypoint.sh \
	&& mkdir -p /data \
	&& chown bun:bun /data

ENV NODE_ENV=production
ENV PORT=8099
EXPOSE 8099

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "dist/server.js"]
