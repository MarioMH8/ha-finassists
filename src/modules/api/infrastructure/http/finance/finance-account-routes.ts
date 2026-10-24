import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed, noContent } from '../shared/http-responses';
import { minorUnits, readJsonBody, requiredText } from '../shared/request-parsing';
import type { FinanceEnvironment, FinanceUseCases } from './finance-route-support';
import { isFlagEnabled, paginated } from './finance-route-support';

const newAccountSchema = z.object({
	kind: requiredText('kind'),
	name: requiredText('name'),
	openingBalanceMinor: minorUnits('openingBalanceMinor'),
});

function createAccountRoutes(useCases: FinanceUseCases): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();
	const { accounts } = useCases;

	routes
		.get('/books/:bookId/accounts', context => {
			const query = context.req.query();
			const list = accounts.list.execute({
				bookId: context.req.param('bookId'),
				includeClosed: isFlagEnabled(query, 'includeClosed'),
			});

			return jsonResponse(paginated(list, query));
		})
		.post('/books/:bookId/accounts', async context => {
			const body = await readJsonBody(context.req.raw, newAccountSchema);

			return jsonResponse(accounts.create.execute({ ...body, bookId: context.req.param('bookId') }), 201);
		})
		.all('/books/:bookId/accounts', () => methodNotAllowed('GET, POST'));

	routes
		.get('/books/:bookId/accounts/:accountId/balances', context => {
			const balances = accounts.balances.execute({
				asOf: context.req.query('asOf'),
				bookId: context.req.param('bookId'),
				id: context.req.param('accountId'),
			});

			return jsonResponse({
				postedMinor: balances.posted.minorUnits,
				reconciledMinor: balances.reconciled.minorUnits,
				totalMinor: balances.total.minorUnits,
			});
		})
		.all('/books/:bookId/accounts/:accountId/balances', () => methodNotAllowed('GET'));

	for (const action of ['open', 'close'] as const) {
		routes
			.post(`/books/:bookId/accounts/:accountId/${action}`, context =>
				accounts[action].execute(context.req.param('bookId'), context.req.param('accountId'))
					? noContent()
					: jsonResponse({ error: 'Account not found or state unchanged' }, 404)
			)
			.all(`/books/:bookId/accounts/:accountId/${action}`, () => methodNotAllowed('POST'));
	}

	return routes;
}

export { createAccountRoutes };
