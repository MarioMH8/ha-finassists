import type { FeatureFlags } from '@modules/shell/domain';
import { DEFAULT_FEATURE_FLAGS } from '@modules/shell/domain';
import { Hono } from 'hono';

import type { FinanceEnvironment, FinanceUseCases, RouteActor } from './finance-route-types';
import { FinanceRoutes } from './finance-routes';

interface FacadeEnvironment {
	Bindings: { actor: RouteActor; features: FeatureFlags; useCases: FinanceUseCases };
	Variables: FinanceEnvironment['Variables'];
}

class FinanceFacade {
	private static facade: Hono<FacadeEnvironment> | undefined;

	private constructor() {}

	static create(): Hono<FacadeEnvironment> {
		const facade = new Hono<FacadeEnvironment>({ strict: false });
		facade.use('*', async (context, next) => {
			context.set('actor', context.env.actor);
			context.set('features', context.env.features);
			context.set('useCases', context.env.useCases);
			await next();
		});
		facade.route('/api/v1', FinanceRoutes.create());

		return facade;
	}

	static async handle(
		request: Request,
		actor: RouteActor,
		useCases: FinanceUseCases,
		features: FeatureFlags = DEFAULT_FEATURE_FLAGS
	): Promise<Response> {
		this.facade ??= this.create();

		return this.facade.fetch(request, { actor, features, useCases });
	}
}

export { FinanceFacade };
