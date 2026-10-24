import { isTrustedIngressPeer, resolveIngressActor } from '@modules/home-assistant';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { authenticateFinancialRequest } from './auth/authentication';
import { createSystemCredentialRoutes } from './auth/system-credential-routes';
import { createTokenRoutes } from './auth/token-routes';
import type { FinanceEnvironment } from './finance/finance-route-support';
import type { FinanceUseCases } from './finance/finance-routes';
import { createFinanceRoutes } from './finance/finance-routes';
import { handleMcpRequest } from './mcp/mcp-transport';
import { withSecurityHeaders } from './security-headers';
import { jsonResponse } from './shared/http-responses';
import type {
	HttpEnvironment,
	RequestContext,
	SystemCredentialUseCases,
	TokenManagementUseCases,
} from './shared/request-context';
import { serveWebAsset } from './web-assets';

function createSessionRoute() {
	return (context: Context<HttpEnvironment>) => {
		const requestContext = context.env.requestContext;
		if (
			requestContext.developmentActor === undefined &&
			!isTrustedIngressPeer(requestContext.remoteAddress, requestContext.trustedIngressIp)
		) {
			return new Response('Forbidden', { headers: { 'Cache-Control': 'no-store' }, status: 403 });
		}

		return Response.json(
			requestContext.developmentActor ??
				resolveIngressActor(
					context.req.raw.headers,
					requestContext.remoteAddress,
					requestContext.trustedIngressIp
				)
		);
	};
}

function createFinanceApp(
	tokenUseCases: TokenManagementUseCases,
	financeUseCases?: FinanceUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Hono<FinanceEnvironment & HttpEnvironment> {
	const routes = new Hono<FinanceEnvironment & HttpEnvironment>({ strict: false });

	routes.use(
		'*',
		createMiddleware<FinanceEnvironment & HttpEnvironment>(async (context, next) => {
			const actor = await authenticateFinancialRequest(
				context.req.raw,
				context.env.requestContext,
				tokenUseCases,
				systemCredentialUseCases
			);
			if (actor instanceof Response) {
				return actor;
			}
			if (actor.kind === 'unknown') {
				return jsonResponse({ error: 'Authentication required' }, 401);
			}
			if (financeUseCases === undefined) {
				return new Response(undefined, { status: 404 });
			}
			context.set('actor', actor);

			return next();
		})
	);
	if (financeUseCases !== undefined) {
		routes.route('/', createFinanceRoutes(financeUseCases));
	}

	return routes;
}

function createFallbackRoute(
	tokenUseCases: TokenManagementUseCases,
	financeUseCases?: FinanceUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
) {
	return async (context: Context<HttpEnvironment>) => {
		const { requestContext } = context.env;
		const { pathname } = new URL(context.req.url);

		if (pathname.endsWith('/mcp')) {
			return financeUseCases === undefined
				? new Response(undefined, { status: 404 })
				: handleMcpRequest(context.req.raw, tokenUseCases, financeUseCases, systemCredentialUseCases);
		}

		if (
			requestContext.developmentActor === undefined &&
			!isTrustedIngressPeer(requestContext.remoteAddress, requestContext.trustedIngressIp)
		) {
			return new Response('Forbidden', { status: 403 });
		}

		if (context.req.method !== 'GET') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		return serveWebAsset(
			pathname,
			context.req.raw,
			requestContext.developmentMode ?? false,
			requestContext.shellConfig ?? DEFAULT_SHELL_CONFIG
		);
	};
}

function createHttpApp(
	tokenUseCases: TokenManagementUseCases,
	financeUseCases?: FinanceUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Hono<HttpEnvironment> {
	const app = new Hono<HttpEnvironment>({ strict: false });

	app.use('*', async (context, next) => {
		await next();
		context.res = withSecurityHeaders(context.res);
	});

	app.get('/health', () => Response.json({ status: 'ok' }));
	app.route('/api/v1/tokens', createTokenRoutes(tokenUseCases));
	app.route('/api/v1/system-credentials', createSystemCredentialRoutes(systemCredentialUseCases));
	app.get('/api/v1/session', createSessionRoute());
	app.route('/api/v1', createFinanceApp(tokenUseCases, financeUseCases, systemCredentialUseCases));
	app.all('*', createFallbackRoute(tokenUseCases, financeUseCases, systemCredentialUseCases));
	app.onError(() => withSecurityHeaders(new Response('Internal Server Error', { status: 500 })));

	return app;
}

async function handleRequest(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases,
	financeUseCases?: FinanceUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<Response> {
	return createHttpApp(tokenUseCases, financeUseCases, systemCredentialUseCases).fetch(request, {
		requestContext: context,
	});
}

export type { FinanceUseCases } from './finance/finance-routes';
export type { SystemCredentialUseCases, TokenManagementUseCases } from './shared/request-context';
export { createHttpApp, handleRequest };
