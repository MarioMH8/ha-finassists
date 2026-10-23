import { isIP } from 'node:net';

import type { HomeAssistantActor } from '@modules/home-assistant';
import { DEFAULT_TRUSTED_INGRESS_IP } from '@modules/home-assistant';

interface ServerConfig {
	databasePath: string;
	developmentActor: HomeAssistantActor | undefined;
	developmentMode: boolean;
	port: number;
	trustedIngressIp: string;
}

interface ServerEnvironment {
	DATABASE_PATH?: string;
	DEV_INGRESS_DISPLAY_NAME?: string;
	DEV_INGRESS_USER_ID?: string;
	DEV_INGRESS_USERNAME?: string;
	NODE_ENV?: string;
	PORT?: string;
	SUPERVISOR_IP?: string;
}

interface LoadServerConfigOptions {
	development?: boolean;
	environment?: ServerEnvironment;
	optionsPath?: string;
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

function readOptionalEnvironmentValue(value: string | undefined): string | undefined {
	const normalized = value?.trim();

	return normalized === '' ? undefined : normalized;
}

function createDevelopmentActor(environment: ServerEnvironment): HomeAssistantActor {
	const id = readOptionalEnvironmentValue(environment.DEV_INGRESS_USER_ID) ?? 'dev-user';
	const username = readOptionalEnvironmentValue(environment.DEV_INGRESS_USERNAME) ?? 'dev';
	const displayName = readOptionalEnvironmentValue(environment.DEV_INGRESS_DISPLAY_NAME) ?? 'Local Developer';

	return {
		displayName,
		id,
		kind: 'home_assistant_user',
		username,
	};
}

async function loadServerConfig({
	development,
	environment = Bun.env,
	optionsPath = './data/options.json',
}: LoadServerConfigOptions = {}): Promise<ServerConfig> {
	const isDevelopment = development ?? environment.NODE_ENV === 'development';
	const hasDevelopmentIdentityConfig =
		environment.DEV_INGRESS_USER_ID !== undefined ||
		environment.DEV_INGRESS_USERNAME !== undefined ||
		environment.DEV_INGRESS_DISPLAY_NAME !== undefined;
	if (!isDevelopment && hasDevelopmentIdentityConfig) {
		throw new Error('Development Ingress identity variables are only allowed in development mode');
	}

	const options = await readOptions(optionsPath);
	const configuredDatabasePath =
		environment.DATABASE_PATH ?? (isDevelopment ? './data/fin-assist.sqlite' : '/data/fin-assist.sqlite');
	const databasePath = configuredDatabasePath.trim();
	if (databasePath.length === 0) {
		throw new Error('DATABASE_PATH must not be empty');
	}

	const configuredIp =
		environment.SUPERVISOR_IP ??
		(isRecord(options) && typeof options.supervisor_ip === 'string' ? options.supervisor_ip : undefined) ??
		DEFAULT_TRUSTED_INGRESS_IP;
	const trustedIngressIp = configuredIp.trim();

	if (!isDevelopment && isIP(trustedIngressIp) === 0) {
		throw new Error('SUPERVISOR_IP must contain a valid IPv4 or IPv6 address');
	}

	const port = environment.PORT === undefined ? 8099 : Number(environment.PORT);
	if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
		throw new Error('PORT must be an integer between 1 and 65535');
	}

	return {
		databasePath,
		developmentActor: isDevelopment ? createDevelopmentActor(environment) : undefined,
		developmentMode: isDevelopment,
		port,
		trustedIngressIp,
	};
}

export { loadServerConfig, type LoadServerConfigOptions, type ServerConfig, type ServerEnvironment };
