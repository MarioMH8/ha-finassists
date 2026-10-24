import { CLASSIFICATION_KIND } from '@modules/classifications/domain';
import { Hono } from 'hono';

import { jsonResponse } from '../shared/http-responses';
import { createAccountRoutes } from './finance-account-routes';
import { createBookRoutes } from './finance-book-routes';
import { createBudgetRoutes } from './finance-budget-routes';
import { createClassificationRoutes } from './finance-classification-routes';
import { createLedgerRoutes } from './finance-ledger-routes';
import type { FinanceEnvironment, FinanceUseCases, RouteActor } from './finance-route-support';
import { routeError } from './finance-route-support';
import { createScheduleRoutes } from './finance-schedule-routes';
import { createSharedExpenseRoutes } from './finance-shared-expense-routes';

function createFinanceRoutes(useCases: FinanceUseCases): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>({ strict: false });

	routes.route('/', createBookRoutes(useCases));
	routes.route('/', createAccountRoutes(useCases));
	routes.route('/', createClassificationRoutes(useCases, 'categories', CLASSIFICATION_KIND.CATEGORY));
	routes.route('/', createClassificationRoutes(useCases, 'classes', CLASSIFICATION_KIND.CLASS));
	routes.route('/', createBudgetRoutes(useCases));
	routes.route('/', createLedgerRoutes(useCases));
	routes.route('/', createScheduleRoutes(useCases));
	routes.route('/', createSharedExpenseRoutes(useCases));
	routes.all('*', () => jsonResponse({ error: 'Not found' }, 404));
	routes.onError(error => routeError(error));

	return routes;
}

interface ActorBindings {
	Bindings: { actor: RouteActor };
	Variables: FinanceEnvironment['Variables'];
}

const facades = new WeakMap<FinanceUseCases, Hono<ActorBindings>>();

function facadeFor(useCases: FinanceUseCases): Hono<ActorBindings> {
	const cached = facades.get(useCases);
	if (cached) {
		return cached;
	}
	const app = new Hono<ActorBindings>({ strict: false });
	app.use('*', async (context, next) => {
		context.set('actor', context.env.actor);
		await next();
	});
	app.route('/api/v1', createFinanceRoutes(useCases));
	facades.set(useCases, app);

	return app;
}

async function handleFinanceRequest(request: Request, actor: RouteActor, useCases: FinanceUseCases): Promise<Response> {
	return facadeFor(useCases).fetch(request, { actor });
}

export { createFinanceRoutes, handleFinanceRequest };

export { type FinanceUseCases } from './finance-route-support';
