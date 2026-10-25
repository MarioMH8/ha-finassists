#!/bin/sh
set -eu

# Home Assistant mounts the app data folder at /data as root when the
# container starts, so prepare it before dropping to the unprivileged user.
if [ "$(id -u)" -eq 0 ]; then
	mkdir -p /data
	chown -R bun:bun /data
	exec su-exec bun "$@"
fi

exec "$@"
