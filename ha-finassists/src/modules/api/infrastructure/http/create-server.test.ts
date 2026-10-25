import { migrateDatabase } from '@modules/storage/infrastructure';
import {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
} from '@modules/system-credentials/application';
import {
	SqliteSystemCredentialRepository,
	WebCryptoSystemCredentialService,
} from '@modules/system-credentials/infrastructure';
import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '@modules/tokens/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import { createServer } from './create-server';
import { createHttpContainer } from './shared/http-container';

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

function createMigratedDatabase(): Database {
	const database = new Database(':memory:');
	migrateDatabase(database);

	return database;
}

function createTokenUseCases() {
	const repository = new SqliteApiTokenRepository(createMigratedDatabase());

	const credentialService = new WebCryptoTokenCredentialService();

	return {
		authenticate: new AuthenticateApiToken(repository, credentialService),
		issue: new IssueApiToken(repository, credentialService),
		list: new ListApiTokens(repository),
		repository,
		revoke: new RevokeApiToken(repository),
	};
}

describe('createServer', () => {
	let server!: ReturnType<typeof createServer>;
	let systemDatabase: Database | undefined;

	async function createSystemCredentialUseCases(capability: string) {
		systemDatabase = new Database(':memory:');
		migrateDatabase(systemDatabase);
		const repository = new SqliteSystemCredentialRepository(systemDatabase);
		const service = new WebCryptoSystemCredentialService();
		repository.configureBootstrapCapability(
			await service.hash(capability),
			new Date(Date.now() + 60_000).toISOString()
		);
		const now = () => new Date();

		return {
			authenticate: new AuthenticateSystemCredential(repository, service),
			exchange: new ExchangeSystemCredential(repository, service, now),
			revoke: new RevokeSystemCredential(repository, service),
			rotate: new RotateSystemCredential(repository, service, now),
		};
	}

	function requestUrl(pathname: string): URL {
		const url = new URL(pathname, server.url);
		url.hostname = '[::1]';

		return url;
	}

	afterEach(async () => {
		await server.stop(true);
		systemDatabase?.close();
		systemDatabase = undefined;
	});

	it('uses the configured development actor and bypasses Ingress peer checks', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			developmentActor: {
				displayName: 'Local Developer',
				id: 'dev-user',
				kind: 'home_assistant_user',
				username: 'dev',
			},
			developmentMode: true,
			port: 0,
			trustedIngressIp: '172.30.32.2',
		});

		const [pageResponse, sessionResponse, tokenResponse, reloadResponse, versionResponse] = await Promise.all([
			fetch(new URL('/', server.url)),
			fetch(new URL('/api/v1/session', server.url)),
			fetch(new URL('/api/v1/tokens', server.url)),
			fetch(new URL('/__dev/reload.js', server.url)),
			fetch(new URL('/__dev/version', server.url)),
		]);
		const page = await pageResponse.text();

		expect(pageResponse.status).toBe(200);
		expect(page).toContain('./__dev/reload.js');
		expect(reloadResponse.status).toBe(200);
		expect(reloadResponse.headers.get('content-type')).toContain('text/javascript');
		const reloadScript = await reloadResponse.text();
		const version = await versionResponse.text();
		expect(reloadScript.includes('setInterval')).toBe(true);
		expect(versionResponse.status).toBe(200);
		expect(version.length).toBeGreaterThan(0);
		expect(sessionResponse.status).toBe(200);
		expect(await sessionResponse.json()).toEqual({
			displayName: 'Local Developer',
			id: 'dev-user',
			kind: 'home_assistant_user',
			username: 'dev',
		});
		expect(tokenResponse.status).toBe(200);
	});

	it('exchanges, rotates, and revokes the dedicated system credential', async () => {
		const capability = 'random-bootstrap-capability-value-of-at-least-32-characters';
		const systemCredentialUseCases = await createSystemCredentialUseCases(capability);
		server = createServer({
			container: createHttpContainer({ systemCredentialUseCases, tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '[IP_ADDRESS]',
		});

		const exchangeResponse = await fetch(new URL('/api/v1/system-credentials/exchange', server.url), {
			body: JSON.stringify({ bootstrapCapability: capability }),
			headers: { 'Content-Type': 'application/json' },
			method: 'POST',
		});
		const exchanged = (await exchangeResponse.json()) as { credential: string; id: string };
		expect(exchangeResponse.status).toBe(201);
		expect(exchangeResponse.headers.get('cache-control')).toBe('no-store');
		expect(exchanged.id).toBe('home-assistant-integration');
		expect(exchanged.credential.startsWith('fa_system_')).toBe(true);

		const replayResponse = await fetch(new URL('/api/v1/system-credentials/exchange', server.url), {
			body: JSON.stringify({ bootstrapCapability: capability }),
			headers: { 'Content-Type': 'application/json' },
			method: 'POST',
		});
		expect(replayResponse.status).toBe(401);

		const personalTokens = createTokenUseCases();
		const personal = await personalTokens.issue.execute({ name: 'Personal', ownerId: 'user-1' });
		const personalRotationResponse = await fetch(new URL('/api/v1/system-credentials/current', server.url), {
			headers: { Authorization: `Bearer ${personal.secret}` },
			method: 'PUT',
		});
		expect(personalRotationResponse.status).toBe(401);

		const rotateResponse = await fetch(new URL('/api/v1/system-credentials/current', server.url), {
			headers: { Authorization: `Bearer ${exchanged.credential}` },
			method: 'PUT',
		});
		const rotated = (await rotateResponse.json()) as { credential: string; id: string };
		expect(rotateResponse.status).toBe(200);
		expect(rotated.id).toBe('home-assistant-integration');
		expect(rotated.credential).not.toBe(exchanged.credential);

		const oldCredentialResponse = await fetch(new URL('/api/v1/transactions', server.url), {
			headers: { Authorization: `Bearer ${exchanged.credential}` },
		});
		const activeCredentialResponse = await fetch(new URL('/api/v1/transactions', server.url), {
			headers: { Authorization: `Bearer ${rotated.credential}` },
		});
		expect(oldCredentialResponse.status).toBe(401);
		expect(activeCredentialResponse.status).toBe(404);

		const revokeResponse = await fetch(new URL('/api/v1/system-credentials/current', server.url), {
			headers: { Authorization: `Bearer ${rotated.credential}` },
			method: 'DELETE',
		});
		expect(revokeResponse.status).toBe(204);
		const revokedCredentialResponse = await fetch(new URL('/api/v1/transactions', server.url), {
			headers: { Authorization: `Bearer ${rotated.credential}` },
		});
		expect(revokedCredentialResponse.status).toBe(401);
	});

	it('serves the health endpoint', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '127.0.0.1',
		});

		const response = await fetch(new URL('/health', server.url));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-security-policy')).toMatch(
			/default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'/u
		);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await response.json()).toEqual({ status: 'ok' });
	});

	it('blocks the web interface for an untrusted peer', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '192.0.2.1',
		});

		const response = await fetch(new URL('/', server.url));
		const tokenResponse = await fetch(new URL('/api/v1/tokens', server.url), {
			headers: { 'X-Remote-User-Id': 'user-123' },
		});

		expect(response.status).toBe(403);
		expect(tokenResponse.status).toBe(403);
	});

	it('serves the web shell to a trusted Ingress peer', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '::1',
		});

		const response = await fetch(requestUrl('/'));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		expect(await response.text()).toContain('<html');
	});

	it('server-renders the Spanish interface using the browser language preference', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '::1',
		});

		const response = await fetch(requestUrl('/'), { headers: { 'Accept-Language': 'es-ES, en;q=0.8' } });
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('vary')).toContain('Accept-Language');
		expect(html).toContain('<html lang="es">');
		expect(html).toMatch(/<h2[^>]*>Nueva transacción<\/h2>/);
		expect(html).toContain('data-language="es"');
		expect(html).toContain('id="root"');
		expect(html).toContain('src="./client.js"');
	});

	it('serves matching CSS Module classes in the server HTML, hydration bundle, and stylesheet', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '::1',
		});

		const [pageResponse, scriptResponse, stylesheetResponse] = await Promise.all([
			fetch(requestUrl('/')),
			fetch(requestUrl('/client.js')),
			fetch(requestUrl('/styles.css')),
		]);
		const [page, script, stylesheet] = await Promise.all([
			pageResponse.text(),
			scriptResponse.text(),
			stylesheetResponse.text(),
		]);
		const moduleClass = /class="[^"]*main-content_[A-Za-z0-9_-]+/
			.exec(page)?.[0]
			.match(/main-content_[A-Za-z0-9_-]+/)?.[0];

		expect(pageResponse.status).toBe(200);
		expect(scriptResponse.status).toBe(200);
		expect(scriptResponse.headers.get('content-type')).toContain('text/javascript');
		expect(stylesheetResponse.status).toBe(200);
		expect(stylesheetResponse.headers.get('content-type')).toContain('text/css');
		expect(stylesheet).toContain('--ha-color-surface-low');
		if (moduleClass === undefined) {
			throw new Error('Expected a CSS Module class in the server-rendered page');
		}
		expect(script).toContain(moduleClass);
		expect(stylesheet).toContain(`.${moduleClass}`);
	});

	it('requires a valid bearer token for external financial API requests', async () => {
		const tokenUseCases = createTokenUseCases();
		const issued = await tokenUseCases.issue.execute({ name: 'External client', ownerId: 'token-owner' });
		server = createServer({
			container: createHttpContainer({ tokenUseCases }),
			port: 0,
			trustedIngressIp: '192.0.2.1',
		});

		const missingTokenResponse = await fetch(new URL('/api/v1/transactions', server.url), {
			headers: { 'X-Remote-User-Id': 'spoofed-user' },
		});
		const invalidTokenResponse = await fetch(new URL('/api/v1/transactions', server.url), {
			headers: { Authorization: 'Bearer invalid-token' },
		});
		const validTokenResponse = await fetch(new URL('/api/v1/transactions', server.url), {
			headers: { Authorization: `Bearer ${issued.secret}` },
		});

		expect(missingTokenResponse.status).toBe(401);
		expect(invalidTokenResponse.status).toBe(401);
		expect(validTokenResponse.status).toBe(404);

		await tokenUseCases.revoke.execute({ id: issued.token.id, ownerId: 'token-owner' });
		const revokedTokenResponse = await fetch(new URL('/api/v1/transactions', server.url), {
			headers: { Authorization: `Bearer ${issued.secret}` },
		});

		expect(revokedTokenResponse.status).toBe(401);
	});

	it('keeps the MCP endpoint out of the web interface', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '::1',
		});

		const response = await fetch(requestUrl('/mcp'));

		expect(response.status).toBe(404);
	});

	it('requires an identified Ingress actor to manage tokens', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '::1',
		});

		const response = await fetch(requestUrl('/api/v1/tokens'));

		expect(response.status).toBe(401);
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('issues, lists and revokes personal tokens through the trusted Ingress API', async () => {
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '::1',
		});
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
		server = createServer({
			container: createHttpContainer({ tokenUseCases: createTokenUseCases() }),
			port: 0,
			trustedIngressIp: '::1',
		});

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
