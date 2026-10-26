import { jsonResponse } from '@modules/api/infrastructure/http/shared/http-responses';
import { Hono } from 'hono';

import { createCategoryRoutes } from './finance-category-routes';
import type { FinanceEnvironment, FinanceUseCases, RouteActor } from './finance-route-support';
import { routeError } from './finance-route-support';
import { createScheduledTransactionRoutes } from './finance-scheduled-transaction-routes';
import { createTransactionRoutes } from './finance-transaction-routes';

function createFinanceRoutes(): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>({ strict: false });

	routes.route('/', createCategoryRoutes());
	routes.route('/', createScheduledTransactionRoutes());
	routes.route('/', createTransactionRoutes());
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
