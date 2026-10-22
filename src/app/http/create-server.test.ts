import { afterEach, describe, expect, it } from 'bun:test';

import { IssueApiToken, ListApiTokens, RevokeApiToken } from '../../modules/tokens/application';
import { InMemoryApiTokenRepository, WebCryptoTokenCredentialService } from '../../modules/tokens/infrastructure';
import { createServer } from './create-server';

interface TokenMetadataResponse {
	createdAt: string;
	id: string;
	name: string;
	prefix: string;
}

interface IssuedTokenResponse extends TokenMetadataResponse {
	secret: string;
}

function isTokenMetadataResponse(value: unknown): value is TokenMetadataResponse {
	return (
		typeof value === 'object' &&
		value !== null &&
		'createdAt' in value &&
		typeof value.createdAt === 'string' &&
		'id' in value &&
		typeof value.id === 'string' &&
		'name' in value &&
		typeof value.name === 'string' &&
		'prefix' in value &&
		typeof value.prefix === 'string'
	);
}

function isIssuedTokenResponse(value: unknown): value is IssuedTokenResponse {
	return isTokenMetadataResponse(value) && 'secret' in value && typeof value.secret === 'string';
}

function isTokenMetadataList(value: unknown): value is TokenMetadataResponse[] {
	return Array.isArray(value) && value.every(isTokenMetadataResponse);
}

function createTokenUseCases() {
	const repository = new InMemoryApiTokenRepository();

	return {
		issue: new IssueApiToken(repository, new WebCryptoTokenCredentialService()),
		list: new ListApiTokens(repository),
		revoke: new RevokeApiToken(repository),
	};
}

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
		server = createServer({ port: 0, tokenUseCases: createTokenUseCases(), trustedIngressIp: '127.0.0.1' });

		const response = await fetch(new URL('/health', server.url));

		expect(response.status).toBe(200);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await response.json()).toEqual({ status: 'ok' });
	});

	it('blocks the web interface for an untrusted peer', async () => {
		server = createServer({ port: 0, tokenUseCases: createTokenUseCases(), trustedIngressIp: '192.0.2.1' });

		const response = await fetch(new URL('/', server.url));
		const tokenResponse = await fetch(new URL('/api/v1/tokens', server.url), {
			headers: { 'X-Remote-User-Id': 'user-123' },
		});

		expect(response.status).toBe(403);
		expect(tokenResponse.status).toBe(403);
	});

	it('serves the web shell to a trusted Ingress peer', async () => {
		server = createServer({ port: 0, tokenUseCases: createTokenUseCases(), trustedIngressIp: '::1' });

		const response = await fetch(requestUrl('/'));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		expect(await response.text()).toContain('<html');
	});

	it('keeps the MCP endpoint out of the web interface', async () => {
		server = createServer({ port: 0, tokenUseCases: createTokenUseCases(), trustedIngressIp: '::1' });

		const response = await fetch(requestUrl('/mcp'));

		expect(response.status).toBe(404);
	});

	it('requires an identified Ingress actor to manage tokens', async () => {
		server = createServer({ port: 0, tokenUseCases: createTokenUseCases(), trustedIngressIp: '::1' });

		const response = await fetch(requestUrl('/api/v1/tokens'));

		expect(response.status).toBe(401);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('issues, lists and revokes personal tokens through the trusted Ingress API', async () => {
		server = createServer({ port: 0, tokenUseCases: createTokenUseCases(), trustedIngressIp: '::1' });
		const headers = {
			'Content-Type': 'application/json',
			'X-Remote-User-Id': 'user-123',
			'X-Remote-User-Name': 'mario',
		};

		const issueResponse = await fetch(requestUrl('/api/v1/tokens'), {
			body: JSON.stringify({ name: 'Personal access' }),
			headers,
			method: 'POST',
		});
		const issuedValue: unknown = await issueResponse.json();
		if (!isIssuedTokenResponse(issuedValue)) {
			throw new Error('Expected a newly issued token response');
		}
		const issued = issuedValue;

		expect(issueResponse.status).toBe(201);
		expect(issued.name).toBe('Personal access');
		expect(issued.prefix.length).toBeGreaterThan(0);
		expect(issued.secret.startsWith('fa_')).toBe(true);
		expect(issued).not.toHaveProperty('secretHash');

		const listResponse = await fetch(requestUrl('/api/v1/tokens'), { headers });
		const listedValue: unknown = await listResponse.json();
		if (!isTokenMetadataList(listedValue)) {
			throw new Error('Expected a token metadata list');
		}
		const listed = listedValue;

		expect(listResponse.status).toBe(200);
		expect(listed).toHaveLength(1);
		expect(listed[0]).not.toHaveProperty('secret');

		const otherUserHeaders = { ...headers, 'X-Remote-User-Id': 'user-456' };
		const otherUserListResponse = await fetch(requestUrl('/api/v1/tokens'), { headers: otherUserHeaders });
		const otherUserRevokeResponse = await fetch(requestUrl(`/api/v1/tokens/${issued.id}`), {
			headers: otherUserHeaders,
			method: 'DELETE',
		});

		expect(otherUserListResponse.status).toBe(200);
		expect(await otherUserListResponse.json()).toEqual([]);
		expect(otherUserRevokeResponse.status).toBe(404);

		const revokeResponse = await fetch(requestUrl(`/api/v1/tokens/${issued.id}`), { headers, method: 'DELETE' });

		expect(revokeResponse.status).toBe(204);
	});

	it('reports the Home Assistant actor for a trusted Ingress peer', async () => {
		server = createServer({ port: 0, tokenUseCases: createTokenUseCases(), trustedIngressIp: '::1' });

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
