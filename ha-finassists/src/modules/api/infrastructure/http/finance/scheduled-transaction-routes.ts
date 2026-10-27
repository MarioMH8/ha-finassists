import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import { RequestParsing } from '@modules/api/infrastructure/http/shared/request-parsing';
import { CalendarDate } from '@modules/ledger/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import type { FinanceEnvironment } from './finance-route-types';
import { ScheduledTransactionJsonMapper } from './mappers/scheduled-transaction-json.mapper';

const DEFAULT_LIMIT = 100;
const DEFAULT_UPCOMING_LIMIT = 100;
const MAX_UPCOMING_LIMIT = 200;

const kindSchema = z.enum(['expense', 'income'], { error: 'kind must be expense or income' });
const frequencySchema = z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly'], {
	error: 'frequency must be once, daily, weekly, monthly or yearly',
});
const postingModeSchema = z.enum(['automatic', 'manual'], {
	error: 'postingMode must be automatic or manual',
});
const scheduledStatusSchema = z.enum(['active', 'paused', 'completed'], {
	error: 'status must be active, paused or completed',
});
const updateStatusSchema = z.enum(['active', 'paused'], {
	error: 'status must be active or paused',
});
const intervalSchema = z
	.number({ error: 'interval must be an integer' })
	.refine(value => Number.isSafeInteger(value) && value >= 1 && value <= 999, {
		error: 'interval must be an integer between 1 and 999',
	})
	.optional();

function requiredDate(name: string) {
	const error = `${name} must use YYYY-MM-DD`;

	return z.string({ error }).regex(/^\d{4}-\d{2}-\d{2}$/u, { error });
}

function optionalDate(name: string) {
	return requiredDate(name).nullable().optional();
}

const listScheduledTransactionQuerySchema = z.object({
	categoryId: z.string({ error: 'categoryId must be a string' }).optional(),
	dueThrough: requiredDate('dueThrough').optional(),
	kind: kindSchema.optional(),
	limit: RequestParsing.nonNegativeInteger('limit', DEFAULT_LIMIT)
		.refine(value => value > 0, { error: 'limit must be greater than zero' })
		.default(DEFAULT_LIMIT),
	offset: RequestParsing.nonNegativeInteger('offset', Number.MAX_SAFE_INTEGER).default(0),
	postingMode: postingModeSchema.optional(),
	search: RequestParsing.optionalText('search'),
	status: scheduledStatusSchema.optional(),
});

const newScheduledTransactionSchema = z.object({
	amountMinor: RequestParsing.minorUnits(),
	categoryId: RequestParsing.nullableReference('categoryId'),
	description: RequestParsing.optionalText('description'),
	endDate: optionalDate('endDate'),
	frequency: frequencySchema,
	interval: intervalSchema,
	kind: kindSchema,
	postingMode: postingModeSchema.optional(),
	startDate: requiredDate('startDate'),
});

const updateScheduledTransactionSchema = z.object({
	amountMinor: RequestParsing.minorUnits().optional(),
	categoryId: RequestParsing.nullableReference('categoryId'),
	description: RequestParsing.optionalText('description'),
	endDate: optionalDate('endDate'),
	frequency: frequencySchema.optional(),
	interval: intervalSchema,
	kind: kindSchema.optional(),
	postingMode: postingModeSchema.optional(),
	startDate: requiredDate('startDate').optional(),
	status: updateStatusSchema.optional(),
});

const upcomingScheduledTransactionQuerySchema = z.object({
	categoryId: z.string({ error: 'categoryId must be a string' }).optional(),
	fromDate: requiredDate('fromDate').optional(),
	kind: kindSchema.optional(),
	limit: RequestParsing.nonNegativeInteger('limit', MAX_UPCOMING_LIMIT)
		.refine(value => value > 0, { error: 'limit must be greater than zero' })
		.default(DEFAULT_UPCOMING_LIMIT),
	offset: RequestParsing.nonNegativeInteger('offset', Number.MAX_SAFE_INTEGER).default(0),
	toDate: requiredDate('toDate').optional(),
});

class ScheduledTransactionRoutes {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create(): Hono<FinanceEnvironment> {
		const routes = new Hono<FinanceEnvironment>();

		routes
			.get('/scheduled-transactions', async context => {
				const { categoryId, dueThrough, kind, limit, offset, postingMode, search, status } =
					RequestParsing.parseInput(listScheduledTransactionQuerySchema, context.req.query());
				const page = await context.var.useCases.ledger.scheduled.list.execute({
					...(categoryId !== undefined && { categoryId }),
					...(dueThrough !== undefined && { dueThrough }),
					...(kind !== undefined && { kind }),
					...(postingMode !== undefined && { postingMode }),
					...(search !== undefined && { search }),
					...(status !== undefined && { status }),
					limit,
					offset,
				});

				return HttpResponses.json({
					items: page.items.map(schedule => ScheduledTransactionJsonMapper.toJson(schedule)),
					limit,
					offset,
					today: context.var.useCases.today(),
					total: page.total,
				});
			})
			.post('/scheduled-transactions', async context => {
				const {
					amountMinor,
					categoryId,
					description,
					endDate,
					frequency,
					interval,
					kind,
					postingMode,
					startDate,
				} = await RequestParsing.readJsonBody(context.req.raw, newScheduledTransactionSchema);

				return HttpResponses.json(
					ScheduledTransactionJsonMapper.toJson(
						await context.var.useCases.ledger.scheduled.create.execute({
							actorId: context.var.actor.id,
							amountMinor,
							...(categoryId !== undefined && { categoryId }),
							...(description !== undefined && { description }),
							...(endDate !== undefined && { endDate }),
							frequency,
							...(interval !== undefined && { interval }),
							kind,
							...(postingMode !== undefined && { postingMode }),
							startDate,
						})
					),
					201
				);
			})
			.get('/scheduled-transactions/upcoming', async context => {
				const { categoryId, fromDate, kind, limit, offset, toDate } = RequestParsing.parseInput(
					upcomingScheduledTransactionQuerySchema,
					context.req.query()
				);
				const today = context.var.useCases.today();
				const from = fromDate ?? today;
				const to = toDate ?? CalendarDate.addDays(from, 29) ?? from;
				const forecast = await context.var.useCases.ledger.scheduled.upcoming.execute({
					...(categoryId !== undefined && { categoryId }),
					...(kind !== undefined && { kind }),
					fromDate: from,
					limit,
					offset,
					toDate: to,
				});

				return HttpResponses.json({
					...forecast,
					fromDate: from,
					toDate: to,
					today,
				});
			})
			.delete('/scheduled-transactions/:id', async context => {
				await context.var.useCases.ledger.scheduled.delete.execute({ id: context.req.param('id') });

				return HttpResponses.noContent();
			})
			.patch('/scheduled-transactions/:id', async context => {
				const {
					amountMinor,
					categoryId,
					description,
					endDate,
					frequency,
					interval,
					kind,
					postingMode,
					startDate,
					status,
				} = await RequestParsing.readJsonBody(context.req.raw, updateScheduledTransactionSchema);
				const schedule = await context.var.useCases.ledger.scheduled.update.execute({
					...(amountMinor !== undefined && { amountMinor }),
					...(categoryId !== undefined && { categoryId }),
					...(description !== undefined && { description }),
					...(endDate !== undefined && { endDate }),
					...(frequency !== undefined && { frequency }),
					...(interval !== undefined && { interval }),
					...(kind !== undefined && { kind }),
					...(postingMode !== undefined && { postingMode }),
					...(startDate !== undefined && { startDate }),
					...(status !== undefined && { status }),
					id: context.req.param('id'),
					today: context.var.useCases.today(),
				});

				return HttpResponses.json(ScheduledTransactionJsonMapper.toJson(schedule));
			})
			.post('/scheduled-transactions/:id/post', async context => {
				const result = await context.var.useCases.ledger.scheduled.post.execute({
					actorId: context.var.actor.id,
					id: context.req.param('id'),
					today: context.var.useCases.today(),
				});

				return HttpResponses.json({
					scheduledTransaction: ScheduledTransactionJsonMapper.toJson(result.schedule),
					transaction: result.transaction,
				});
			})
			.post('/scheduled-transactions/:id/skip', async context => {
				const schedule = await context.var.useCases.ledger.scheduled.skip.execute({
					id: context.req.param('id'),
					today: context.var.useCases.today(),
				});

				return HttpResponses.json(ScheduledTransactionJsonMapper.toJson(schedule));
			})
			.all('/scheduled-transactions', () => HttpResponses.methodNotAllowed('GET, POST'))
			.all('/scheduled-transactions/upcoming', () => HttpResponses.methodNotAllowed('GET'))
			.all('/scheduled-transactions/:id', () => HttpResponses.methodNotAllowed('DELETE, PATCH'))
			.all('/scheduled-transactions/:id/post', () => HttpResponses.methodNotAllowed('POST'))
			.all('/scheduled-transactions/:id/skip', () => HttpResponses.methodNotAllowed('POST'));

		return routes;
	}
}

export { ScheduledTransactionRoutes };
