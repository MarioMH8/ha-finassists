import { afterEach, describe, expect, it } from 'bun:test';

import { createServer } from './create-server';

describe('createServer', () => {
	let server!: ReturnType<typeof createServer>;

	function requestUrl(pathname: string): URL {
		const url = new URL(pathname, server.url);
		url.hostname = '[::1]';

		return url;
	}

	afterEach(async () => {
		await server.stop(true);
	});

	it('serves the health endpoint', async () => {
		server = createServer({ port: 0, trustedIngressIp: '127.0.0.1' });

		const response = await fetch(new URL('/health', server.url));

		expect(response.status).toBe(200);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await response.json()).toEqual({ status: 'ok' });
	});

	it('blocks the web interface for an untrusted peer', async () => {
		server = createServer({ port: 0, trustedIngressIp: '192.0.2.1' });

		const response = await fetch(new URL('/', server.url));

		expect(response.status).toBe(403);
	});

	it('serves the web shell to a trusted Ingress peer', async () => {
		server = createServer({ port: 0, trustedIngressIp: '::1' });

		const response = await fetch(requestUrl('/'));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		expect(await response.text()).toContain('<html');
	});

	it('keeps the MCP endpoint out of the web interface', async () => {
		server = createServer({ port: 0, trustedIngressIp: '::1' });

		const response = await fetch(requestUrl('/mcp'));

		expect(response.status).toBe(404);
	});

	it('reports the Home Assistant actor for a trusted Ingress peer', async () => {
		server = createServer({ port: 0, trustedIngressIp: '::1' });

		const response = await fetch(requestUrl('/api/v1/session'), {
			headers: {
				'X-Remote-User-Id': 'user-123',
				'X-Remote-User-Name': 'mario',
			},
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: 'user-123',
			kind: 'home_assistant_user',
			username: 'mario',
		});
	});
});
