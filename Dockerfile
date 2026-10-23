FROM oven/bun:1.4.0-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY tsconfig.json ./
RUN bun run build

FROM oven/bun:1.4.0-alpine

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown bun:bun /data
USER bun

ENV NODE_ENV=production
ENV PORT=8099
EXPOSE 8099

CMD ["bun", "run", "dist/server.js"]
