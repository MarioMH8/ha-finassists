import { isTrustedIngressPeer, resolveIngressActor } from '../../platform/ingress/actor';
import { withSecurityHeaders } from './security-headers';
import { serveWebAsset } from './web-assets';

interface RequestContext {
	remoteAddress: string | undefined;
	trustedIngressIp: string;
}

function routeRequest(request: Request, context: RequestContext): Response {
	const pathname = new URL(request.url).pathname;

	if (request.method === 'GET' && pathname.endsWith('/health')) {
		return Response.json({ status: 'ok' });
	}

	if (request.method === 'GET' && pathname.endsWith('/api/v1/session')) {
		return Response.json(resolveIngressActor(request.headers, context.remoteAddress, context.trustedIngressIp));
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

export function handleRequest(request: Request, context: RequestContext): Response {
	return withSecurityHeaders(routeRequest(request, context));
}
