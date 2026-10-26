import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import { Hono } from 'hono';

import { CategoryRoutes } from './finance-category-routes';
import type { FinanceEnvironment, FinanceUseCases, RouteActor } from './finance-route-support';
import { FinanceRouteError } from './finance-route-support';
import { ScheduledTransactionRoutes } from './finance-scheduled-transaction-routes';
import { TransactionRoutes } from './finance-transaction-routes';

class FinanceRoutes {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create(): Hono<FinanceEnvironment> {
		const routes = new Hono<FinanceEnvironment>({ strict: false });

		routes.route('/', CategoryRoutes.create());
		routes.route('/', ScheduledTransactionRoutes.create());
		routes.route('/', TransactionRoutes.create());
		routes.all('*', () => HttpResponses.json({ error: 'Not found' }, 404));
		routes.onError(error => FinanceRouteError.toResponse(error));

		return routes;
	}
}

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

export { FinanceFacade, FinanceRoutes };

export { type FinanceUseCases } from './finance-route-support';
