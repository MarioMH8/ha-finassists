import { isIP } from 'node:net';

import { DEFAULT_TRUSTED_INGRESS_IP } from '../platform/ingress/actor';

interface ServerConfig {
	databasePath: string;
	port: number;
	trustedIngressIp: string;
}

interface ServerEnvironment {
	DATABASE_PATH?: string;
	PORT?: string;
	SUPERVISOR_IP?: string;
}

async function readOptions(optionsPath: string): Promise<unknown> {
	const file = Bun.file(optionsPath);
	if (!(await file.exists())) {
		return {};
	}

	return file.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function loadServerConfig(
	environment: ServerEnvironment = Bun.env as ServerEnvironment,
	optionsPath = './data/options.json'
): Promise<ServerConfig> {
	const options = await readOptions(optionsPath);
	const configuredDatabasePath = environment.DATABASE_PATH ?? './data/fin-assist.sqlite';
	const databasePath = configuredDatabasePath.trim();
	if (databasePath.length === 0) {
		throw new Error('DATABASE_PATH must not be empty');
	}

	const configuredIp =
		environment.SUPERVISOR_IP ??
		(isRecord(options) && typeof options.supervisor_ip === 'string' ? options.supervisor_ip : undefined) ??
		DEFAULT_TRUSTED_INGRESS_IP;
	const trustedIngressIp = configuredIp.trim();

	if (isIP(trustedIngressIp) === 0) {
		throw new Error('SUPERVISOR_IP must contain a valid IPv4 or IPv6 address');
	}

	const port = environment.PORT === undefined ? 8099 : Number(environment.PORT);
	if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
		throw new Error('PORT must be an integer between 1 and 65535');
	}

	return { databasePath, port, trustedIngressIp };
}

export { loadServerConfig, type ServerConfig, type ServerEnvironment };
