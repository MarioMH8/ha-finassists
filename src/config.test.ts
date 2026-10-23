import { DEFAULT_TRUSTED_INGRESS_IP } from '@modules/home-assistant';
import { describe, expect, it } from 'bun:test';

import { loadServerConfig } from './config';

describe('loadServerConfig', () => {
	it('uses the Ingress default and application port when no options exist', async () => {
		const config = await loadServerConfig({
			environment: { NODE_ENV: 'production' },
			optionsPath: '/tmp/fin-assist-options-not-found.json',
		});

		expect(config).toEqual({
			databasePath: '/data/fin-assist.sqlite',
			developmentActor: undefined,
			developmentMode: false,
			port: 8099,
			trustedIngressIp: DEFAULT_TRUSTED_INGRESS_IP,
		});
	});

	it('rejects development identity configuration outside development mode', async () => {
		let configError: unknown;
		try {
			await loadServerConfig({
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
		const config = await loadServerConfig({
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
