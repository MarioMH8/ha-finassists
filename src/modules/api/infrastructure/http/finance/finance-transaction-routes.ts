import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed } from '../shared/http-responses';
import { minorUnits, nonNegativeInteger, optionalText, parseInput, readJsonBody } from '../shared/request-parsing';
import type { FinanceEnvironment } from './finance-route-support';

const DEFAULT_LIMIT = 100;

function dateParameter(name: string) {
	const error = `${name} must use YYYY-MM-DD`;

	return z
		.string({ error })
		.regex(/^\d{4}-\d{2}-\d{2}$/u, { error })
		.optional();
}

const listTransactionsQuerySchema = z.object({
	fromDate: dateParameter('fromDate'),
	kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }).optional(),
	limit: nonNegativeInteger('limit', DEFAULT_LIMIT)
		.refine(value => value > 0, { error: 'limit must be greater than zero' })
		.default(DEFAULT_LIMIT),
	offset: nonNegativeInteger('offset', Number.MAX_SAFE_INTEGER).default(0),
	toDate: dateParameter('toDate'),
});

const newTransactionSchema = z.object({
	amountMinor: minorUnits(),
	description: optionalText('description'),
	kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }),
	transactionDate: z.string({ error: 'transactionDate must use YYYY-MM-DD' }),
});

function createTransactionRoutes(): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();

	routes
		.get('/transactions', async context => {
			const { fromDate, kind, limit, offset, toDate } = parseInput(
				listTransactionsQuerySchema,
				context.req.query()
			);
			const page = await context.var.useCases.ledger.list.execute({
				...(fromDate !== undefined && { fromDate }),
				...(kind !== undefined && { kind }),
				...(toDate !== undefined && { toDate }),
				limit,
				offset,
			});

			return jsonResponse({ items: page.items, limit, offset, total: page.total });
		})
		.post('/transactions', async context => {
			const { amountMinor, description, kind, transactionDate } = await readJsonBody(
				context.req.raw,
				newTransactionSchema
			);

			return jsonResponse(
				await context.var.useCases.ledger.create.execute({
					actorId: context.var.actor.id,
					amountMinor,
					kind,
					transactionDate,
					...(description !== undefined && { description }),
				}),
				201
			);
		})
		.all('/transactions', () => methodNotAllowed('GET, POST'));

	return routes;
}

export { createTransactionRoutes };
