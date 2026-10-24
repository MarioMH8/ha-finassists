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

function createFinanceRoutes(): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>({ strict: false });

	routes.route('/', createBookRoutes());
	routes.route('/', createAccountRoutes());
	routes.route('/', createClassificationRoutes('categories', CLASSIFICATION_KIND.CATEGORY));
	routes.route('/', createClassificationRoutes('classes', CLASSIFICATION_KIND.CLASS));
	routes.route('/', createBudgetRoutes());
	routes.route('/', createLedgerRoutes());
	routes.route('/', createScheduleRoutes());
	routes.route('/', createSharedExpenseRoutes());
	routes.all('*', () => jsonResponse({ error: 'Not found' }, 404));
	routes.onError(error => routeError(error));

	return routes;
}

interface FacadeEnvironment {
	Bindings: { actor: RouteActor; useCases: FinanceUseCases };
	Variables: FinanceEnvironment['Variables'];
}

function createFacade(): Hono<FacadeEnvironment> {
	const facade = new Hono<FacadeEnvironment>({ strict: false });
	facade.use('*', async (context, next) => {
		context.set('actor', context.env.actor);
		context.set('useCases', context.env.useCases);
		await next();
	});
	facade.route('/api/v1', createFinanceRoutes());

	return facade;
}

const facades = new Map<'default', Hono<FacadeEnvironment>>();

async function handleFinanceRequest(request: Request, actor: RouteActor, useCases: FinanceUseCases): Promise<Response> {
	let facade = facades.get('default');
	if (facade === undefined) {
		facade = createFacade();
		facades.set('default', facade);
	}

	return facade.fetch(request, { actor, useCases });
}

export { createFinanceRoutes, handleFinanceRequest };

export { type FinanceUseCases } from './finance-route-support';
