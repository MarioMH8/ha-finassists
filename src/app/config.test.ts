import { describe, expect, it } from 'bun:test';

import { DEFAULT_TRUSTED_INGRESS_IP } from '../platform/ingress/actor';
import { loadServerConfig } from './config';

describe('loadServerConfig', () => {
	it('uses the Ingress default and application port when no options exist', async () => {
		const config = await loadServerConfig({}, '/tmp/fin-assist-options-not-found.json');

		expect(config).toEqual({
			databasePath: './data/fin-assist.sqlite',
			port: 8099,
			trustedIngressIp: DEFAULT_TRUSTED_INGRESS_IP,
		});
	});
});
