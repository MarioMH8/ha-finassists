import { jsonResponse, methodNotAllowed, noContent } from '@modules/api/infrastructure/http/shared/http-responses';
import {
	minorUnits,
	nonNegativeInteger,
	nullableReference,
	optionalText,
	parseInput,
	readJsonBody,
} from '@modules/api/infrastructure/http/shared/request-parsing';
import { Hono } from 'hono';
import { z } from 'zod';

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
	categoryId: z.string({ error: 'categoryId must be a string' }).optional(),
	fromDate: dateParameter('fromDate'),
	kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }).optional(),
	limit: nonNegativeInteger('limit', DEFAULT_LIMIT)
		.refine(value => value > 0, { error: 'limit must be greater than zero' })
		.default(DEFAULT_LIMIT),
	offset: nonNegativeInteger('offset', Number.MAX_SAFE_INTEGER).default(0),
	search: optionalText('search'),
	toDate: dateParameter('toDate'),
});

const newTransactionSchema = z.object({
	amountMinor: minorUnits(),
	categoryId: nullableReference('categoryId'),
	description: optionalText('description'),
	kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }),
	transactionDate: z.string({ error: 'transactionDate must use YYYY-MM-DD' }),
});

const updateTransactionSchema = z.object({
	amountMinor: minorUnits().optional(),
	categoryId: nullableReference('categoryId'),
	description: optionalText('description'),
	kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }).optional(),
	transactionDate: z.string({ error: 'transactionDate must use YYYY-MM-DD' }).optional(),
});

const transactionIdsSchema = z.object({
	ids: z
		.array(z.string({ error: 'ids must be an array of strings' }), {
			error: 'ids must be an array of strings',
		})
		.min(1, { error: 'ids must contain at least one transaction' })
		.max(100, { error: 'ids cannot contain more than 100 transactions' }),
});

function createTransactionRoutes(): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();

	routes
		.get('/transactions', async context => {
			const { categoryId, fromDate, kind, limit, offset, search, toDate } = parseInput(
				listTransactionsQuerySchema,
				context.req.query()
			);
			const page = await context.var.useCases.ledger.list.execute({
				...(categoryId !== undefined && { categoryId }),
				...(fromDate !== undefined && { fromDate }),
				...(kind !== undefined && { kind }),
				...(search !== undefined && { search }),
				...(toDate !== undefined && { toDate }),
				limit,
				offset,
			});

			return jsonResponse({ items: page.items, limit, offset, total: page.total });
		})
		.post('/transactions', async context => {
			const { amountMinor, categoryId, description, kind, transactionDate } = await readJsonBody(
				context.req.raw,
				newTransactionSchema
			);

			return jsonResponse(
				await context.var.useCases.ledger.create.execute({
					actorId: context.var.actor.id,
					amountMinor,
					...(categoryId !== undefined && { categoryId }),
					kind,
					transactionDate,
					...(description !== undefined && { description }),
				}),
				201
			);
		})
		.delete('/transactions', async context => {
			const { ids } = await readJsonBody(context.req.raw, transactionIdsSchema);
			await context.var.useCases.ledger.deleteMany.execute({ ids });

			return noContent();
		})
		.delete('/transactions/:id', async context => {
			await context.var.useCases.ledger.delete.execute({ id: context.req.param('id') });

			return noContent();
		})
		.patch('/transactions/:id', async context => {
			const { amountMinor, categoryId, description, kind, transactionDate } = await readJsonBody(
				context.req.raw,
				updateTransactionSchema
			);
			const transaction = await context.var.useCases.ledger.update.execute({
				id: context.req.param('id'),
				...(amountMinor !== undefined && { amountMinor }),
				...(categoryId !== undefined && { categoryId }),
				...(description !== undefined && { description }),
				...(kind !== undefined && { kind }),
				...(transactionDate !== undefined && { transactionDate }),
			});

			return jsonResponse(transaction);
		})
		.all('/transactions', () => methodNotAllowed('GET, POST, DELETE'))
		.all('/transactions/:id', () => methodNotAllowed('DELETE, PATCH'));

	return routes;
}

export { createTransactionRoutes };
