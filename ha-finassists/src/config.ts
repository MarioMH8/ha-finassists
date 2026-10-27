import { isIP } from 'node:net';

import type { HomeAssistantActor } from '@modules/home-assistant';
import { DEFAULT_TRUSTED_INGRESS_IP } from '@modules/home-assistant';
import type { ShellConfig } from '@modules/shell/domain';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import { z } from 'zod';

interface ServerConfig {
	bootstrapCapability: string | undefined;
	databasePath: string;
	developmentActor: HomeAssistantActor | undefined;
	developmentMode: boolean;
	port: number;
	shellConfig: ShellConfig;
	supervisorToken: string | undefined;
	timeZone: string;
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
	SUPERVISOR_TOKEN?: string;
	SYSTEM_CREDENTIAL_BOOTSTRAP_CAPABILITY?: string;
	TZ?: string;
}

interface LoadServerConfigOptions {
	development?: boolean;
	environment?: ServerEnvironment;
	optionsPath?: string;
}

const homeAssistantOptionsSchema = z
	.object({
		application_name: z.string().optional().catch(undefined),
		currency: z.string().optional().catch(undefined),
		supervisor_ip: z.string().optional().catch(undefined),
	})
	.catch({});

class ServerConfigLoader {
	private constructor() {}

	static async load({
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

		const options = homeAssistantOptionsSchema.parse(await this.readOptions(optionsPath));
		const configuredDatabasePath =
			environment.DATABASE_PATH ?? (isDevelopment ? './data/fin-assist.sqlite' : '/data/fin-assist.sqlite');
		const databasePath = configuredDatabasePath.trim();
		if (databasePath.length === 0) {
			throw new Error('DATABASE_PATH must not be empty');
		}

		const configuredIp = environment.SUPERVISOR_IP ?? options.supervisor_ip ?? DEFAULT_TRUSTED_INGRESS_IP;
		const trustedIngressIp = configuredIp.trim();

		if (isIP(trustedIngressIp) === 0) {
			throw new Error('SUPERVISOR_IP must contain a valid IPv4 or IPv6 address');
		}

		const normalizedName = options.application_name?.trim() ?? '';
		const shellConfig: ShellConfig = {
			applicationName:
				normalizedName.length > 0 && normalizedName.length <= 80 && !this.hasControlCharacters(normalizedName)
					? normalizedName
					: DEFAULT_SHELL_CONFIG.applicationName,
			currencyCode: this.normalizeCurrencyCode(options.currency),
		};

		const bootstrapCapability = this.readOptionalEnvironmentValue(
			environment.SYSTEM_CREDENTIAL_BOOTSTRAP_CAPABILITY
		);
		if (bootstrapCapability !== undefined && bootstrapCapability.length < 32) {
			throw new Error('SYSTEM_CREDENTIAL_BOOTSTRAP_CAPABILITY must contain at least 32 characters');
		}

		const port = environment.PORT === undefined ? 8099 : Number(environment.PORT);
		if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
			throw new Error('PORT must be an integer between 1 and 65535');
		}

		return {
			bootstrapCapability,
			databasePath,
			developmentActor: isDevelopment ? this.createDevelopmentActor(environment) : undefined,
			developmentMode: isDevelopment,
			port,
			shellConfig,
			supervisorToken: this.readOptionalEnvironmentValue(environment.SUPERVISOR_TOKEN),
			timeZone: this.resolveTimeZone(environment.TZ),
			trustedIngressIp,
		};
	}

	private static createDevelopmentActor(environment: ServerEnvironment): HomeAssistantActor {
		const id = this.readOptionalEnvironmentValue(environment.DEV_INGRESS_USER_ID) ?? 'dev-user';
		const username = this.readOptionalEnvironmentValue(environment.DEV_INGRESS_USERNAME) ?? 'dev';
		const displayName =
			this.readOptionalEnvironmentValue(environment.DEV_INGRESS_DISPLAY_NAME) ?? 'Local Developer';

		return {
			displayName,
			id,
			kind: 'home_assistant_user',
			username,
		};
	}

	private static hasControlCharacters(value: string): boolean {
		for (const character of value) {
			const codePoint = character.codePointAt(0) ?? 0;
			if (codePoint === 127 || codePoint <= 31) {
				return true;
			}
		}

		return false;
	}

	private static normalizeCurrencyCode(value: string | undefined): string {
		const code = value?.trim().toUpperCase() ?? '';
		if (!/^[A-Z]{3}$/.test(code)) {
			return DEFAULT_SHELL_CONFIG.currencyCode;
		}
		try {
			return (
				new Intl.NumberFormat('en', { currency: code, style: 'currency' }).resolvedOptions().currency ?? code
			);
		} catch {
			return DEFAULT_SHELL_CONFIG.currencyCode;
		}
	}

	private static readOptionalEnvironmentValue(value: string | undefined): string | undefined {
		const normalized = value?.trim();

		return normalized === '' ? undefined : normalized;
	}

	private static async readOptions(optionsPath: string): Promise<unknown> {
		const file = Bun.file(optionsPath);
		if (!(await file.exists())) {
			return {};
		}

		return file.json();
	}

	private static resolveTimeZone(value: string | undefined): string {
		const configured = value?.trim();
		const timeZone =
			configured === undefined || configured === ''
				? new Intl.DateTimeFormat().resolvedOptions().timeZone
				: configured;
		try {
			const formatter = new Intl.DateTimeFormat('en', { timeZone });

			return formatter.resolvedOptions().timeZone;
		} catch {
			throw new Error('TZ must be a valid IANA time zone');
		}
	}
}

export { type LoadServerConfigOptions, type ServerConfig, ServerConfigLoader, type ServerEnvironment };
