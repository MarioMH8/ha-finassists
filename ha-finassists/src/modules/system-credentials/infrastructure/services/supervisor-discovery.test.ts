import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { createBootstrapCapability, publishSupervisorDiscovery } from './supervisor-discovery';

afterEach(() => {
	mock.restore();
});

describe('Supervisor discovery provisioning', () => {
	it('uses the global fetch when no fetcher is provided', async () => {
		const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(undefined, { status: 200 }));

		await publishSupervisorDiscovery('supervisor-token', 'fa_bootstrap_capability');

		expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://supervisor/discovery');
	});

	it('generates a unique URL-safe bootstrap capability', () => {
		const first = createBootstrapCapability();
		const second = createBootstrapCapability();

		expect(first).toMatch(/^fa_bootstrap_[A-Za-z0-9_-]{43}$/);
		expect(second).toMatch(/^fa_bootstrap_[A-Za-z0-9_-]{43}$/);
		expect(second).not.toBe(first);
	});

	it('publishes the add-on integration configuration using the Supervisor token', async () => {
		let request: Request | undefined;
		const fetcher: (input: string, init: RequestInit) => Promise<Response> = (input, init) => {
			request = new Request(input, init);

			return Promise.resolve(new Response(undefined, { status: 200 }));
		};
		const capability = 'fa_bootstrap_discovery-capability';

		await publishSupervisorDiscovery('supervisor-token', capability, fetcher);

		expect(request?.url).toBe('http://supervisor/discovery');
		expect(request?.method).toBe('POST');
		expect(request?.headers.get('Authorization')).toBe('Bearer supervisor-token');
		expect(request?.headers.get('Content-Type')).toBe('application/json');
		expect(await request?.json()).toEqual({
			config: { bootstrapCapability: capability },
			service: 'ha_finassists',
		});
	});

	it('does not expose the capability when Supervisor rejects discovery', async () => {
		const capability = 'fa_bootstrap_secret-capability';
		const fetcher: (input: string, init: RequestInit) => Promise<Response> = () =>
			Promise.resolve(new Response('rejected', { status: 403 }));
		let failure: unknown;

		try {
			await publishSupervisorDiscovery('supervisor-token', capability, fetcher);
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toBe('Home Assistant Supervisor discovery publishing failed (HTTP 403)');
		expect((failure as Error).message).not.toContain(capability);
	});

	it('does not expose the capability when the Supervisor request fails', async () => {
		const capability = 'fa_bootstrap_secret-capability';
		const fetcher: (input: string, init: RequestInit) => Promise<Response> = () =>
			Promise.reject(new Error(`network failure: ${capability}`));
		let failure: unknown;

		try {
			await publishSupervisorDiscovery('supervisor-token', capability, fetcher);
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toBe('Home Assistant Supervisor discovery publishing failed');
		expect((failure as Error).message).not.toContain(capability);
	});
});
