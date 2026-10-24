import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed, noContent } from '../shared/http-responses';
import {
	compact,
	minorUnits,
	nullableReference,
	optionalText,
	parseInput,
	readJsonBody,
	requiredText,
} from '../shared/request-parsing';
import type { FinanceEnvironment } from './finance-route-support';
import { paginated, readImportRequest } from './finance-route-support';

const transactionStatusSchema = z.enum(['uncleared', 'cleared', 'reconciled'], { error: 'status is invalid' });

function dateParameter(name: string) {
	const error = `${name} must use YYYY-MM-DD`;

	return z
		.string({ error })
		.regex(/^\d{4}-\d{2}-\d{2}$/u, { error })
		.optional();
}

const listTransactionsQuerySchema = z.object({
	accountId: requiredText('accountId'),
	fromDate: dateParameter('fromDate'),
	status: transactionStatusSchema.optional(),
	toDate: dateParameter('toDate'),
});

const transactionPartSchema = z.object(
	{
		amountMinor: minorUnits(),
		categoryId: nullableReference('categoryId'),
		classId: nullableReference('classId'),
		memo: optionalText('memo'),
	},
	{ error: 'Each transaction part must be an object' }
);

const partsSchema = z.array(transactionPartSchema, { error: 'parts must be an array' });

const newTransactionSchema = z.object({
	accountId: requiredText('accountId'),
	amountMinor: minorUnits(),
	memo: optionalText('memo'),
	parts: partsSchema.optional(),
	payee: optionalText('payee'),
	transactionDate: requiredText('transactionDate'),
});

const updateTransactionSchema = z.object({
	accountId: optionalText('accountId'),
	amountMinor: minorUnits().optional(),
	memo: optionalText('memo'),
	parts: partsSchema.optional(),
	payee: optionalText('payee'),
	transactionDate: optionalText('transactionDate'),
});

const transactionStatusBodySchema = z.object({ status: transactionStatusSchema });

const newTransferSchema = z.object({
	amountMinor: minorUnits(),
	fromAccountId: requiredText('fromAccountId'),
	memo: optionalText('memo'),
	toAccountId: requiredText('toAccountId'),
	transactionDate: requiredText('transactionDate'),
});

function createLedgerRoutes(): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();

	routes
		.get('/books/:bookId/transactions', context => {
			const query = context.req.query();
			const { accountId, fromDate, status, toDate } = parseInput(listTransactionsQuerySchema, query);
			const transactions = context.var.useCases.ledger.list
				.execute(context.req.param('bookId'), accountId)
				.filter(
					transaction =>
						(fromDate === undefined || transaction.transactionDate >= fromDate) &&
						(toDate === undefined || transaction.transactionDate <= toDate) &&
						(status === undefined || transaction.status === status)
				);

			return jsonResponse(paginated(transactions, query));
		})
		.post('/books/:bookId/transactions', async context => {
			const body = await readJsonBody(context.req.raw, newTransactionSchema);

			return jsonResponse(
				context.var.useCases.ledger.create.execute({
					...body,
					actorId: context.var.actor.id,
					bookId: context.req.param('bookId'),
				}),
				201
			);
		})
		.all('/books/:bookId/transactions', () => methodNotAllowed('GET, POST'));

	routes
		.patch('/books/:bookId/transactions/:transactionId', async context => {
			const body = await readJsonBody(context.req.raw, updateTransactionSchema);
			const updated = context.var.useCases.ledger.update.execute(
				context.req.param('bookId'),
				context.req.param('transactionId'),
				compact(body)
			);

			return updated ? jsonResponse(updated) : jsonResponse({ error: 'Transaction not found' }, 404);
		})
		.delete('/books/:bookId/transactions/:transactionId', context =>
			context.var.useCases.ledger.delete.execute(context.req.param('bookId'), context.req.param('transactionId'))
				? noContent()
				: jsonResponse({ error: 'Transaction not found or reconciled' }, 409)
		)
		.all('/books/:bookId/transactions/:transactionId', () => methodNotAllowed('PATCH, DELETE'));

	routes
		.put('/books/:bookId/transactions/:transactionId/status', async context => {
			const { status } = await readJsonBody(context.req.raw, transactionStatusBodySchema);

			return context.var.useCases.ledger.setStatus.execute(
				context.req.param('bookId'),
				context.req.param('transactionId'),
				status
			)
				? noContent()
				: jsonResponse({ error: 'Transaction not found or status transition is not allowed' }, 409);
		})
		.all('/books/:bookId/transactions/:transactionId/status', () => methodNotAllowed('PUT'));

	routes
		.post('/books/:bookId/transfers', async context => {
			const body = await readJsonBody(context.req.raw, newTransferSchema);

			return jsonResponse(
				context.var.useCases.ledger.createTransfer.execute({
					...body,
					actorId: context.var.actor.id,
					bookId: context.req.param('bookId'),
				}),
				201
			);
		})
		.all('/books/:bookId/transfers', () => methodNotAllowed('POST'));

	routes
		.post('/books/:bookId/imports/preview', async context => {
			const input = await readImportRequest(context.req.raw, context.req.param('bookId'), context.var.actor.id);

			return jsonResponse(context.var.useCases.imports.preview.execute(input));
		})
		.all('/books/:bookId/imports/preview', () => methodNotAllowed('POST'));

	routes
		.post('/books/:bookId/imports/commit', async context => {
			const input = await readImportRequest(context.req.raw, context.req.param('bookId'), context.var.actor.id);

			return jsonResponse(context.var.useCases.imports.commit.execute(input), 201);
		})
		.all('/books/:bookId/imports/commit', () => methodNotAllowed('POST'));

	return routes;
}

export { createLedgerRoutes };
