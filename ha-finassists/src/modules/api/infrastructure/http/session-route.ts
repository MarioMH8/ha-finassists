import { IngressActorResolver, TrustedIngressPeer } from '@modules/home-assistant';
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
				!TrustedIngressPeer.isTrusted(requestContext.remoteAddress, requestContext.trustedIngressIp)
			) {
				return HttpResponses.text('Forbidden', 403, { 'Cache-Control': 'no-store' });
			}

			return HttpResponses.json(
				requestContext.developmentActor ??
					IngressActorResolver.resolve(
						context.req.raw.headers,
						requestContext.remoteAddress,
						requestContext.trustedIngressIp
					)
			);
		};
	}
}

export { SessionRoute };
