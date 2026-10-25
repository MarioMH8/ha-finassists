#!/bin/sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
	exec su-exec bun bun run /app/backup-pre.ts
fi

exec bun run /app/backup-pre.ts
