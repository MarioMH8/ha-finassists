import { isTrustedIngressPeer, resolveIngressActor } from '@modules/home-assistant';
import type { Context } from 'hono';

import { HttpResponses } from './shared/http-responses';
import type { HttpEnvironment } from './shared/request-context';

class SessionRoute {
	private constructor() {}

	static create(): (context: Context<HttpEnvironment>) => Response {
		return context => {
			const requestContext = context.env.requestContext;
			if (
				requestContext.developmentActor === undefined &&
				!isTrustedIngressPeer(requestContext.remoteAddress, requestContext.trustedIngressIp)
			) {
				return HttpResponses.text('Forbidden', 403, { 'Cache-Control': 'no-store' });
			}

			return HttpResponses.json(
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
