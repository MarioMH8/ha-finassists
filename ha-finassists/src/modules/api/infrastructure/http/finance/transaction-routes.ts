import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import { RequestParsing } from '@modules/api/infrastructure/http/shared/request-parsing';
import { Hono } from 'hono';
import { z } from 'zod';

import type { FinanceEnvironment } from './finance-route-types';

const DEFAULT_LIMIT = 100;

class TransactionRoutes {
	private static readonly listTransactionsQuerySchema = z.object({
		categoryId: z.string({ error: 'categoryId must be a string' }).optional(),
		fromDate: TransactionRoutes.dateParameter('fromDate'),
		kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }).optional(),
		limit: RequestParsing.nonNegativeInteger('limit', DEFAULT_LIMIT)
			.refine(value => value > 0, { error: 'limit must be greater than zero' })
			.default(DEFAULT_LIMIT),
		offset: RequestParsing.nonNegativeInteger('offset', Number.MAX_SAFE_INTEGER).default(0),
		search: RequestParsing.optionalText('search'),
		toDate: TransactionRoutes.dateParameter('toDate'),
	});

	private static readonly newTransactionSchema = z.object({
		amountMinor: RequestParsing.minorUnits(),
		categoryId: RequestParsing.nullableReference('categoryId'),
		description: RequestParsing.optionalText('description'),
		kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }),
		transactionDate: z.string({ error: 'transactionDate must use YYYY-MM-DD' }),
	});

	private static readonly transactionIdsSchema = z.object({
		ids: z
			.array(z.string({ error: 'ids must be an array of strings' }), {
				error: 'ids must be an array of strings',
			})
			.min(1, { error: 'ids must contain at least one transaction' })
			.max(100, { error: 'ids cannot contain more than 100 transactions' }),
	});

	private static readonly updateTransactionSchema = z.object({
		amountMinor: RequestParsing.minorUnits().optional(),
		categoryId: RequestParsing.nullableReference('categoryId'),
		description: RequestParsing.optionalText('description'),
		kind: z.enum(['expense', 'income'], { error: 'kind must be expense or income' }).optional(),
		transactionDate: z.string({ error: 'transactionDate must use YYYY-MM-DD' }).optional(),
	});

	private constructor() {}

	static create(): Hono<FinanceEnvironment> {
		const routes = new Hono<FinanceEnvironment>();

		routes
			.get('/transactions', async context => {
				const { categoryId, fromDate, kind, limit, offset, search, toDate } = RequestParsing.parseInput(
					this.listTransactionsQuerySchema,
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

				return HttpResponses.json({ items: page.items, limit, offset, total: page.total });
			})
			.post('/transactions', async context => {
				const { amountMinor, categoryId, description, kind, transactionDate } =
					await RequestParsing.readJsonBody(context.req.raw, this.newTransactionSchema);

				return HttpResponses.json(
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
				const { ids } = await RequestParsing.readJsonBody(context.req.raw, this.transactionIdsSchema);
				await context.var.useCases.ledger.deleteMany.execute({ ids });

				return HttpResponses.noContent();
			})
			.delete('/transactions/:id', async context => {
				await context.var.useCases.ledger.delete.execute({ id: context.req.param('id') });

				return HttpResponses.noContent();
			})
			.patch('/transactions/:id', async context => {
				const { amountMinor, categoryId, description, kind, transactionDate } =
					await RequestParsing.readJsonBody(context.req.raw, this.updateTransactionSchema);
				const transaction = await context.var.useCases.ledger.update.execute({
					id: context.req.param('id'),
					...(amountMinor !== undefined && { amountMinor }),
					...(categoryId !== undefined && { categoryId }),
					...(description !== undefined && { description }),
					...(kind !== undefined && { kind }),
					...(transactionDate !== undefined && { transactionDate }),
				});

				return HttpResponses.json(transaction);
			})
			.all('/transactions', () => HttpResponses.methodNotAllowed('GET, POST, DELETE'))
			.all('/transactions/:id', () => HttpResponses.methodNotAllowed('DELETE, PATCH'));

		return routes;
	}

	private static dateParameter(name: string) {
		const error = `${name} must use YYYY-MM-DD`;

		return z
			.string({ error })
			.regex(/^\d{4}-\d{2}-\d{2}$/u, { error })
			.optional();
	}
}

export { TransactionRoutes };
