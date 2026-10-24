import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed } from '../shared/http-responses';
import { minorUnits, nullableReference, readJsonBody, requiredText } from '../shared/request-parsing';
import type { FinanceEnvironment, FinanceUseCases } from './finance-route-support';
import { paginated } from './finance-route-support';

const newBudgetSchema = z.object({
	accountId: requiredText('accountId'),
	categoryId: nullableReference('categoryId'),
	classId: nullableReference('classId'),
	name: requiredText('name'),
	periodEnd: requiredText('periodEnd'),
	periodStart: requiredText('periodStart'),
	plannedMinor: minorUnits('plannedMinor'),
});

function createBudgetRoutes(useCases: FinanceUseCases): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();
	const { budgets } = useCases;

	routes
		.get('/books/:bookId/budgets', context => {
			const query = context.req.query();
			const accountId = context.req.query('accountId');
			const list = budgets.list.execute({
				bookId: context.req.param('bookId'),
				...(accountId !== undefined && { accountId }),
			});

			return jsonResponse(paginated(list, query));
		})
		.post('/books/:bookId/budgets', async context => {
			const body = await readJsonBody(context.req.raw, newBudgetSchema);

			return jsonResponse(budgets.create.execute({ ...body, bookId: context.req.param('bookId') }), 201);
		})
		.all('/books/:bookId/budgets', () => methodNotAllowed('GET, POST'));

	routes
		.get('/books/:bookId/budgets/:budgetId/report', context =>
			jsonResponse(
				budgets.getReport.execute({ bookId: context.req.param('bookId'), id: context.req.param('budgetId') })
			)
		)
		.all('/books/:bookId/budgets/:budgetId/report', () => methodNotAllowed('GET'));

	return routes;
}

export { createBudgetRoutes };
