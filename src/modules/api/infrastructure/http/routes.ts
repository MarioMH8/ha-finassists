import type { AppShellSettings } from '@modules/app-configuration/domain';
import { DEFAULT_APP_SHELL_SETTINGS } from '@modules/app-configuration/domain';
import type { HomeAssistantActor, IngressActor } from '@modules/home-assistant';
import { isTrustedIngressPeer, resolveIngressActor } from '@modules/home-assistant';
import type {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
} from '@modules/system-credentials/application';
import type { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';

import type { FinanceUseCases } from './finance-routes';
import { handleFinanceRequest } from './finance-routes';
import { handleMcpRequest } from './mcp-transport';
import { withSecurityHeaders } from './security-headers';
import { serveWebAsset } from './web-assets';

interface RequestContext {
	appShellSettings?: AppShellSettings;
	developmentActor?: HomeAssistantActor;
	developmentMode?: boolean;
	remoteAddress: string | undefined;
	trustedIngressIp: string;
}

interface TokenManagementUseCases {
	authenticate: AuthenticateApiToken;
	issue: IssueApiToken;
	list: ListApiTokens;
	revoke: RevokeApiToken;
}

interface SystemCredentialUseCases {
	authenticate: AuthenticateSystemCredential;
	exchange: ExchangeSystemCredential;
	revoke: RevokeSystemCredential;
	rotate: RotateSystemCredential;
}

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status });
}

function tokenMetadata(token: Awaited<ReturnType<ListApiTokens['execute']>>[number]) {
	return {
		createdAt: token.createdAt,
		id: token.id,
		name: token.name,
		prefix: token.prefix,
	};
}

function tokenActor(request: Request, context: RequestContext): Response | { id: string } {
	if (context.developmentActor !== undefined) {
		return { id: context.developmentActor.id };
	}

	if (!isTrustedIngressPeer(context.remoteAddress, context.trustedIngressIp)) {
		return new Response('Forbidden', { headers: { 'Cache-Control': 'no-store' }, status: 403 });
	}

	const actor = resolveIngressActor(request.headers, context.remoteAddress, context.trustedIngressIp);
	if (actor.kind === 'unknown') {
		return new Response('Unauthorized', { headers: { 'Cache-Control': 'no-store' }, status: 401 });
	}

	return { id: actor.id };
}

async function handleTokenCollection(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases
): Promise<Response> {
	const actor = tokenActor(request, context);
	if (actor instanceof Response) {
		return actor;
	}

	if (request.method === 'GET') {
		const tokens = await tokenUseCases.list.execute(actor.id);

		return jsonResponse(tokens.map(token => tokenMetadata(token)));
	}

	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { headers: { Allow: 'GET, POST' }, status: 405 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON body' }, 400);
	}

	if (!isRecord(body) || typeof body.name !== 'string' || body.name.trim().length > 80) {
		return jsonResponse({ error: 'Token name must contain between 1 and 80 characters' }, 400);
	}

	try {
		const issued = await tokenUseCases.issue.execute({ name: body.name, ownerId: actor.id });

		return jsonResponse({ ...tokenMetadata(issued.token), secret: issued.secret }, 201);
	} catch (error) {
		if (error instanceof Error && error.name === 'TokenNameRequiredError') {
			return jsonResponse({ error: 'Token name must contain between 1 and 80 characters' }, 400);
		}

		throw error;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function handleTokenRevocation(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases,
	id: string
): Promise<Response> {
	const actor = tokenActor(request, context);
	if (actor instanceof Response) {
		return actor;
	}

	if (request.method !== 'DELETE') {
		return new Response('Method Not Allowed', { headers: { Allow: 'DELETE' }, status: 405 });
	}

	let decodedId: string;
	try {
		decodedId = decodeURIComponent(id);
	} catch {
		return jsonResponse({ error: 'Invalid token id' }, 400);
	}

	const isRevoked = await tokenUseCases.revoke.execute({ id: decodedId, ownerId: actor.id });

	return isRevoked ? new Response(undefined, { status: 204 }) : new Response('Not Found', { status: 404 });
}

function bearerSecret(request: Request): string | undefined {
	const authorizationParts = (request.headers.get('authorization') ?? '').trim().split(/\s+/u, 3);
	const [scheme = '', secret = ''] = authorizationParts;

	return secret && authorizationParts.length === 2 && scheme.toLowerCase() === 'bearer' ? secret : undefined;
}

async function authenticateSystemBearer(
	request: Request,
	systemCredentialUseCases: SystemCredentialUseCases
): Promise<IngressActor | Response> {
	const secret = bearerSecret(request);
	if (secret === undefined) {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}

	const credential = await systemCredentialUseCases.authenticate.execute(secret);

	return credential
		? { id: credential.id, kind: 'home_assistant_integration' }
		: jsonResponse({ error: 'Authentication required' }, 401);
}

async function authenticateBearer(
	request: Request,
	tokenUseCases: TokenManagementUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<IngressActor | Response> {
	const secret = bearerSecret(request);
	if (secret === undefined) {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}

	if (systemCredentialUseCases !== undefined) {
		const credential = await systemCredentialUseCases.authenticate.execute(secret);
		if (credential) {
			return { id: credential.id, kind: 'home_assistant_integration' };
		}
	}

	const token = await tokenUseCases.authenticate.execute(secret);
	if (!token) {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}

	return { id: token.ownerId, kind: 'home_assistant_user' };
}

async function authenticateFinancialRequest(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<IngressActor | Response> {
	const secret = bearerSecret(request);
	if (systemCredentialUseCases !== undefined && secret !== undefined) {
		const credential = await systemCredentialUseCases.authenticate.execute(secret);
		if (credential) {
			return { id: credential.id, kind: 'home_assistant_integration' };
		}
	}
	if (context.developmentActor !== undefined) {
		return context.developmentActor;
	}

	if (isTrustedIngressPeer(context.remoteAddress, context.trustedIngressIp)) {
		return resolveIngressActor(request.headers, context.remoteAddress, context.trustedIngressIp);
	}

	return authenticateBearer(request, tokenUseCases, systemCredentialUseCases);
}

async function handleSystemCredentialExchange(
	request: Request,
	systemCredentialUseCases: SystemCredentialUseCases | undefined
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { headers: { Allow: 'POST' }, status: 405 });
	}
	if (systemCredentialUseCases === undefined) {
		return jsonResponse({ error: 'System credential bootstrap is not configured' }, 503);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON body' }, 400);
	}
	if (
		!isRecord(body) ||
		typeof body.bootstrapCapability !== 'string' ||
		body.bootstrapCapability.length < 32 ||
		body.bootstrapCapability.length > 4096
	) {
		return jsonResponse({ error: 'A valid bootstrapCapability is required' }, 400);
	}

	const issued = await systemCredentialUseCases.exchange.execute(body.bootstrapCapability);

	return issued
		? jsonResponse(issued, 201)
		: jsonResponse({ error: 'Bootstrap capability is invalid or expired' }, 401);
}

async function handleCurrentSystemCredential(
	request: Request,
	systemCredentialUseCases: SystemCredentialUseCases | undefined
): Promise<Response> {
	if (request.method !== 'PUT' && request.method !== 'DELETE') {
		return new Response('Method Not Allowed', { headers: { Allow: 'PUT, DELETE' }, status: 405 });
	}
	if (systemCredentialUseCases === undefined) {
		return new Response(undefined, { status: 404 });
	}
	const actor = await authenticateSystemBearer(request, systemCredentialUseCases);
	if (actor instanceof Response) {
		return actor;
	}
	const secret = bearerSecret(request);
	if (secret === undefined) {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}

	if (request.method === 'DELETE') {
		const isRevoked = await systemCredentialUseCases.revoke.execute(secret);

		return isRevoked ? new Response(undefined, { status: 204 }) : new Response('Not Found', { status: 404 });
	}

	const rotated = await systemCredentialUseCases.rotate.execute(secret);

	return rotated ? jsonResponse(rotated) : jsonResponse({ error: 'Authentication required' }, 401);
}

async function routeRequest(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases,
	financeUseCases?: FinanceUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<Response> {
	const pathname = new URL(request.url).pathname;
	if (request.method === 'GET' && pathname.endsWith('/health')) {
		return Response.json({ status: 'ok' });
	}

	const pathSegments = pathname.split('/').filter(Boolean);
	const apiIndex = pathSegments.lastIndexOf('api');
	const apiSegments = apiIndex !== -1 && pathSegments[apiIndex + 1] === 'v1' ? pathSegments.slice(apiIndex + 2) : [];
	const tokenId = apiSegments.length === 2 && apiSegments[0] === 'tokens' ? apiSegments[1] : undefined;

	if (apiSegments[0] === 'system-credentials' && apiSegments.length === 2) {
		if (apiSegments[1] === 'exchange') {
			return handleSystemCredentialExchange(request, systemCredentialUseCases);
		}
		if (apiSegments[1] === 'current') {
			return handleCurrentSystemCredential(request, systemCredentialUseCases);
		}
	}

	if (request.method === 'GET' && pathname.endsWith('/api/v1/session')) {
		if (
			context.developmentActor === undefined &&
			!isTrustedIngressPeer(context.remoteAddress, context.trustedIngressIp)
		) {
			return new Response('Forbidden', { headers: { 'Cache-Control': 'no-store' }, status: 403 });
		}

		return Response.json(
			context.developmentActor ??
				resolveIngressActor(request.headers, context.remoteAddress, context.trustedIngressIp)
		);
	}

	if (pathname.endsWith('/api/v1/tokens')) {
		return handleTokenCollection(request, context, tokenUseCases);
	}

	if (tokenId) {
		return handleTokenRevocation(request, context, tokenUseCases, tokenId);
	}

	if (apiSegments.length > 0 && apiSegments[0] !== 'tokens' && apiSegments[0] !== 'session') {
		const actor = await authenticateFinancialRequest(request, context, tokenUseCases, systemCredentialUseCases);
		if (actor instanceof Response) {
			return actor;
		}
		if (actor.kind === 'unknown') {
			return jsonResponse({ error: 'Authentication required' }, 401);
		}

		return financeUseCases === undefined
			? new Response(undefined, { status: 404 })
			: handleFinanceRequest(request, actor, financeUseCases);
	}

	if (pathname.endsWith('/mcp')) {
		return financeUseCases === undefined
			? new Response(undefined, { status: 404 })
			: handleMcpRequest(request, tokenUseCases, financeUseCases, systemCredentialUseCases);
	}

	if (
		context.developmentActor === undefined &&
		!isTrustedIngressPeer(context.remoteAddress, context.trustedIngressIp)
	) {
		return new Response('Forbidden', { status: 403 });
	}

	if (request.method !== 'GET') {
		return new Response('Method Not Allowed', { status: 405 });
	}

	return serveWebAsset(
		pathname,
		request,
		context.developmentMode ?? false,
		context.appShellSettings ?? DEFAULT_APP_SHELL_SETTINGS
	);
}

export async function handleRequest(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases,
	financeUseCases?: FinanceUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<Response> {
	return withSecurityHeaders(
		await routeRequest(request, context, tokenUseCases, financeUseCases, systemCredentialUseCases)
	);
}

export type { SystemCredentialUseCases, TokenManagementUseCases };

export { type FinanceUseCases } from './finance-routes';
