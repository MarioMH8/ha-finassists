import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { DEFAULT_TRUSTED_INGRESS_IP } from '@modules/home-assistant';
import { describe, expect, it } from 'bun:test';

import { ServerConfigLoader } from './config';

describe('ServerConfigLoader.load', () => {
	it('uses the Ingress default and application port when no options exist', async () => {
		const config = await ServerConfigLoader.load({
			environment: { NODE_ENV: 'production', TZ: 'UTC' },
			optionsPath: '/tmp/fin-assist-options-not-found.json',
		});

		expect(config).toEqual({
			bootstrapCapability: undefined,
			databasePath: '/data/fin-assist.sqlite',
			developmentActor: undefined,
			developmentMode: false,
			port: 8099,
			shellConfig: { applicationName: 'Fin Assist', currencyCode: 'EUR' },
			supervisorToken: undefined,
			timeZone: 'UTC',
			trustedIngressIp: DEFAULT_TRUSTED_INGRESS_IP,
		});
	});

	it('accepts an IANA time zone and rejects an invalid one', async () => {
		const config = await ServerConfigLoader.load({
			environment: { NODE_ENV: 'production', TZ: 'Europe/Madrid' },
			optionsPath: '/tmp/fin-assist-options-not-found.json',
		});

		expect(config.timeZone).toBe('Europe/Madrid');

		let configError: unknown;
		try {
			await ServerConfigLoader.load({
				environment: { NODE_ENV: 'production', TZ: 'Mars/Olympus' },
				optionsPath: '/tmp/fin-assist-options-not-found.json',
			});
		} catch (error) {
			configError = error;
		}

		expect(configError).toBeInstanceOf(Error);
		expect((configError as Error).message).toBe('TZ must be a valid IANA time zone');
	});

	it('applies each Home Assistant option only when its value has the expected shape', async () => {
		const directory = await mkdtemp(path.join(tmpdir(), 'fin-assist-config-'));
		const optionsPath = path.join(directory, 'options.json');

		try {
			await writeFile(
				optionsPath,
				JSON.stringify({
					application_name: 'Invalid\u{0}name',
					currency: 'euro',
					supervisor_ip: ['127.0.0.1'],
				})
			);
			const config = await ServerConfigLoader.load({
				environment: { NODE_ENV: 'production' },
				optionsPath,
			});

			expect(config.shellConfig).toEqual({
				applicationName: 'Fin Assist',
				currencyCode: 'EUR',
			});
			expect(config.trustedIngressIp).toBe(DEFAULT_TRUSTED_INGRESS_IP);
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});

	it('accepts a Supervisor token for add-on discovery provisioning', async () => {
		const config = await ServerConfigLoader.load({
			environment: { NODE_ENV: 'production', SUPERVISOR_TOKEN: 'supervisor-token' },
			optionsPath: './data/fin-assist-options-not-found.json',
		});

		expect(config.supervisorToken).toBe('supervisor-token');
	});

	it('accepts a valid Supervisor IP override', async () => {
		const config = await ServerConfigLoader.load({
			environment: { NODE_ENV: 'production', SUPERVISOR_IP: '192.168.1.10' },
			optionsPath: '/tmp/fin-assist-options-not-found.json',
		});

		expect(config.trustedIngressIp).toBe('192.168.1.10');
	});

	it('rejects an invalid Supervisor IP override', async () => {
		let configError: unknown;
		try {
			await ServerConfigLoader.load({
				environment: { NODE_ENV: 'production', SUPERVISOR_IP: '[invalid]' },
				optionsPath: '/tmp/fin-assist-options-not-found.json',
			});
		} catch (error) {
			configError = error;
		}

		expect(configError).toBeInstanceOf(Error);
		expect((configError as Error).message).toBe('SUPERVISOR_IP must contain a valid IPv4 or IPv6 address');
	});

	it('rejects development identity configuration outside development mode', async () => {
		let configError: unknown;
		try {
			await ServerConfigLoader.load({
				environment: { DEV_INGRESS_USER_ID: 'local-mario', NODE_ENV: 'production' },
				optionsPath: '/tmp/fin-assist-options-not-found.json',
			});
		} catch (error) {
			configError = error;
		}

		expect(configError).toBeInstanceOf(Error);
		expect((configError as Error).message).toBe(
			'Development Ingress identity variables are only allowed in development mode'
		);
	});

	it('uses configurable mock identity only when development is explicitly enabled', async () => {
		const config = await ServerConfigLoader.load({
			development: true,
			environment: {
				DEV_INGRESS_DISPLAY_NAME: 'Local Mario',
				DEV_INGRESS_USER_ID: 'local-mario',
				DEV_INGRESS_USERNAME: 'mario',
			},
			optionsPath: '/tmp/fin-assist-options-not-found.json',
		});

		expect(config.developmentActor).toEqual({
			displayName: 'Local Mario',
			id: 'local-mario',
			kind: 'home_assistant_user',
			username: 'mario',
		});
		expect(config.developmentMode).toBe(true);
	});
});
