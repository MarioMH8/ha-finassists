import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import { Hono } from 'hono';

import { CategoryRoutes } from './category-routes';
import { FinanceRouteError } from './finance-route-error';
import type { FinanceEnvironment } from './finance-route-types';
import { ScheduledTransactionRoutes } from './scheduled-transaction-routes';
import { TransactionRoutes } from './transaction-routes';

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

export { FinanceRoutes };
