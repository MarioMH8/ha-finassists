FROM oven/bun:1.4.0-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV PORT=8099
EXPOSE 8099

CMD ["bun", "run", "src/app/server.ts"]
