/* eslint-disable unicorn/name-replacements -- The adapter keeps its full domain name. */
import { inferdiHono } from '@inferdi/hono';
import { TrustedIngressPeer } from '@modules/home-assistant';
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { FinancialAuthentication } from './auth/financial-authentication';
import { SystemCredentialRoutes } from './auth/system-credential-routes';
import { TokenRoutes } from './auth/token-routes';
import { CapabilitiesRoute } from './capabilities-route';
import type { FinanceEnvironment } from './finance/finance-route-types';
import { FinanceRoutes } from './finance/finance-routes';
import { McpTransport } from './mcp/mcp-transport';
import { SecurityHeaders } from './security-headers';
import { SessionRoute } from './session-route';
import type { HttpContainer } from './shared/http-container';
import { HttpResponses } from './shared/http-responses';
import type { HttpEnvironment, RequestContext } from './shared/request-context';
import { WebAssets } from './web-assets';

class HttpApplication {
	private constructor() {}

	static create(container: HttpContainer): Hono<HttpEnvironment> {
		const app = new Hono<HttpEnvironment>({ strict: false });

		app.use('*', async (context, next) => {
			await next();
			context.res = SecurityHeaders.apply(context.res);
		});
		app.use('*', inferdiHono({ container }));
		app.use('*', async (context, next) => {
			context.set('features', context.env.requestContext.shellConfig?.features ?? DEFAULT_FEATURE_FLAGS);
			await next();
		});

		app.get('/health', () => HttpResponses.json({ status: 'ok' }));
		app.route('/api/v1/tokens', TokenRoutes.create());
		app.route('/api/v1/system-credentials', SystemCredentialRoutes.create());
		app.get('/api/v1/session', SessionRoute.create());
		app.get('/api/v1/capabilities', CapabilitiesRoute.create());
		app.route('/api/v1', this.createFinanceApp());
		app.all('*', this.createFallbackRoute());
		app.onError(() => SecurityHeaders.apply(HttpResponses.text('Internal Server Error', 500)));

		return app;
	}

	static async handle(request: Request, context: RequestContext, container: HttpContainer): Promise<Response> {
		return this.create(container).fetch(request, { requestContext: context });
	}

	private static createFallbackRoute() {
		return async (context: Context<HttpEnvironment>) => {
			const { requestContext } = context.env;
			const { pathname } = new URL(context.req.url);

			if (pathname.endsWith('/mcp')) {
				const financeUseCases = context.var.di.get('financeUseCases');

				return financeUseCases === undefined
					? HttpResponses.empty(404)
					: McpTransport.handle(
							context.req.raw,
							context.var.di.get('tokenUseCases'),
							financeUseCases,
							context.var.di.get('systemCredentialUseCases'),
							context.var.features
						);
			}

			if (
				requestContext.developmentActor === undefined &&
				!TrustedIngressPeer.isTrusted(requestContext.remoteAddress, requestContext.trustedIngressIp)
			) {
				return HttpResponses.text('Forbidden', 403);
			}

			if (context.req.method !== 'GET') {
				return HttpResponses.text('Method Not Allowed', 405);
			}

			return WebAssets.serve(
				pathname,
				context.req.raw,
				requestContext.developmentMode ?? false,
				requestContext.shellConfig ?? DEFAULT_SHELL_CONFIG
			);
		};
	}

	private static createFinanceApp(): Hono<FinanceEnvironment & HttpEnvironment> {
		const routes = new Hono<FinanceEnvironment & HttpEnvironment>({ strict: false });

		routes.use(
			'*',
			createMiddleware<FinanceEnvironment & HttpEnvironment>(async (context, next) => {
				const actor = await FinancialAuthentication.authenticate(
					context.req.raw,
					context.env.requestContext,
					context.var.di.get('tokenUseCases'),
					context.var.di.get('systemCredentialUseCases')
				);
				if (actor instanceof Response) {
					return actor;
				}
				if (actor.kind === 'unknown') {
					return HttpResponses.json({ error: 'Authentication required' }, 401);
				}
				const financeUseCases = context.var.di.get('financeUseCases');
				if (financeUseCases === undefined) {
					return HttpResponses.empty(404);
				}
				context.set('actor', actor);
				context.set('useCases', financeUseCases);

				return next();
			})
		);
		routes.route('/', FinanceRoutes.create());

		return routes;
	}
}

export type { FinanceUseCases } from './finance/finance-route-types';
export type { HttpContainer, HttpScope, HttpServices } from './shared/http-container';
export type { SystemCredentialUseCases, TokenManagementUseCases } from './shared/request-context';
export { HttpApplication };
