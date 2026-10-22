import type { IssueApiToken, ListApiTokens, RevokeApiToken } from '../../modules/tokens/application';
import { isTrustedIngressPeer, resolveIngressActor } from '../../platform/ingress/actor';
import { withSecurityHeaders } from './security-headers';
import { serveWebAsset } from './web-assets';

interface RequestContext {
	remoteAddress: string | undefined;
	trustedIngressIp: string;
}

interface TokenManagementUseCases {
	issue: IssueApiToken;
	list: ListApiTokens;
	revoke: RevokeApiToken;
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

async function routeRequest(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases
): Promise<Response> {
	const pathname = new URL(request.url).pathname;
	const tokenId = /(?:^|\/)api\/v1\/tokens\/(?<id>[^/]+)$/.exec(pathname)?.groups?.id;

	if (request.method === 'GET' && pathname.endsWith('/health')) {
		return Response.json({ status: 'ok' });
	}

	if (request.method === 'GET' && pathname.endsWith('/api/v1/session')) {
		return Response.json(resolveIngressActor(request.headers, context.remoteAddress, context.trustedIngressIp));
	}

	if (pathname.endsWith('/api/v1/tokens')) {
		return handleTokenCollection(request, context, tokenUseCases);
	}

	if (tokenId) {
		return handleTokenRevocation(request, context, tokenUseCases, tokenId);
	}

	if (pathname.includes('/api/') || pathname.endsWith('/mcp') || pathname.includes('/mcp/')) {
		return new Response(undefined, { status: 404 });
	}

	if (!isTrustedIngressPeer(context.remoteAddress, context.trustedIngressIp)) {
		return new Response('Forbidden', { status: 403 });
	}

	if (request.method !== 'GET') {
		return new Response('Method Not Allowed', { status: 405 });
	}

	return serveWebAsset(pathname);
}

export async function handleRequest(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases
): Promise<Response> {
	return withSecurityHeaders(await routeRequest(request, context, tokenUseCases));
}

export type { TokenManagementUseCases };
