import type { Context } from 'hono';

import { FinancialAuthentication } from './auth/financial-authentication';
import { HttpResponses } from './shared/http-responses';
import type { HttpEnvironment } from './shared/request-context';

class CapabilitiesRoute {
	private constructor() {}

	static create(): (context: Context<HttpEnvironment>) => Promise<Response> {
		return async context => {
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

			return HttpResponses.json({
				features: {
					categories: context.var.features.capabilities.categories,
					scheduledTransactions: context.var.features.capabilities.scheduledTransactions,
				},
			});
		};
	}
}

export { CapabilitiesRoute };
