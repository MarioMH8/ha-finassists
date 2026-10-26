import { isTrustedIngressPeer, resolveIngressActor } from '@modules/home-assistant';
import type { Context } from 'hono';

import type { HttpEnvironment } from './shared/request-context';

class SessionRoute {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create(): (context: Context<HttpEnvironment>) => Response {
		return context => {
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
}

export { SessionRoute };
