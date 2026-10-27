import { Hono } from 'hono';

import type { FinanceEnvironment, FinanceUseCases, RouteActor } from './finance-route-types';
import { FinanceRoutes } from './finance-routes';

interface FacadeEnvironment {
	Bindings: { actor: RouteActor; useCases: FinanceUseCases };
	Variables: FinanceEnvironment['Variables'];
}

class FinanceFacade {
	private static facade: Hono<FacadeEnvironment> | undefined;

	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create(): Hono<FacadeEnvironment> {
		const facade = new Hono<FacadeEnvironment>({ strict: false });
		facade.use('*', async (context, next) => {
			context.set('actor', context.env.actor);
			context.set('useCases', context.env.useCases);
			await next();
		});
		facade.route('/api/v1', FinanceRoutes.create());

		return facade;
	}

	static async handle(request: Request, actor: RouteActor, useCases: FinanceUseCases): Promise<Response> {
		this.facade ??= this.create();

		return this.facade.fetch(request, { actor, useCases });
	}
}

export { FinanceFacade };
