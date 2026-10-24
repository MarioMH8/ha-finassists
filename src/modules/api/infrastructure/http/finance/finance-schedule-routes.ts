import { randomUUID } from 'node:crypto';

import { SCHEDULE_FREQUENCY, SCHEDULE_STATUS } from '@modules/schedules/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed } from '../shared/http-responses';
import {
	compact,
	minorUnits,
	nonNegativeInteger,
	optionalNumber,
	optionalText,
	readJsonBody,
	requiredText,
} from '../shared/request-parsing';
import type { FinanceEnvironment, FinanceUseCases } from './finance-route-support';
import { paginated } from './finance-route-support';

const newScheduleSchema = z.object({
	accountId: requiredText('accountId'),
	amountMinor: minorUnits(),
	endDate: optionalText('endDate'),
	frequency: requiredText('frequency').pipe(z.enum(SCHEDULE_FREQUENCY, { error: 'frequency is invalid' })),
	interval: optionalNumber('interval'),
	memo: optionalText('memo'),
	occurrenceLimit: optionalNumber('occurrenceLimit'),
	payee: optionalText('payee'),
	startDate: requiredText('startDate'),
});

const updateScheduleSchema = z.object({
	amountMinor: minorUnits().optional(),
	endDate: optionalText('endDate'),
	memo: optionalText('memo'),
	occurrenceLimit: optionalNumber('occurrenceLimit'),
	payee: optionalText('payee'),
});

const changeScheduleStatusSchema = z.object({
	status: z.enum([SCHEDULE_STATUS.ACTIVE, SCHEDULE_STATUS.CANCELED, SCHEDULE_STATUS.PAUSED], {
		error: 'status is invalid',
	}),
});

const maxOccurrencesSchema = z
	.union([z.number(), z.string()], { error: 'maxOccurrences must be a non-negative integer' })
	.transform(value => value.toString())
	.pipe(nonNegativeInteger('maxOccurrences', 500))
	.refine(value => value > 0, { error: 'maxOccurrences must be greater than zero' })
	.optional();

const generateOccurrencesSchema = z.object({
	maxOccurrences: maxOccurrencesSchema,
	throughDate: requiredText('throughDate'),
});

const recordOccurrenceSchema = z.object({ transactionId: requiredText('transactionId') });

function createScheduleRoutes(useCases: FinanceUseCases): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();
	const { schedules } = useCases;

	routes
		.get('/books/:bookId/schedules', context => {
			const list = schedules.list.execute(context.req.param('bookId'));

			return jsonResponse(paginated(list, context.req.query()));
		})
		.post('/books/:bookId/schedules', async context => {
			const body = await readJsonBody(context.req.raw, newScheduleSchema);

			return jsonResponse(
				schedules.create.execute({
					...compact(body),
					accountId: body.accountId,
					amountMinor: body.amountMinor,
					bookId: context.req.param('bookId'),
					frequency: body.frequency,
					id: randomUUID(),
					startDate: body.startDate,
				}),
				201
			);
		})
		.all('/books/:bookId/schedules', () => methodNotAllowed('GET, POST'));

	routes
		.patch('/books/:bookId/schedules/:scheduleId', async context => {
			const body = await readJsonBody(context.req.raw, updateScheduleSchema);

			return jsonResponse(
				schedules.update.execute(context.req.param('bookId'), context.req.param('scheduleId'), compact(body))
			);
		})
		.all('/books/:bookId/schedules/:scheduleId', () => methodNotAllowed('PATCH'));

	routes
		.put('/books/:bookId/schedules/:scheduleId/status', async context => {
			const { status } = await readJsonBody(context.req.raw, changeScheduleStatusSchema);

			return jsonResponse(
				schedules.changeStatus.execute(context.req.param('bookId'), context.req.param('scheduleId'), status)
			);
		})
		.all('/books/:bookId/schedules/:scheduleId/status', () => methodNotAllowed('PUT'));

	routes
		.get('/books/:bookId/schedules/:scheduleId/occurrences', context => {
			const list = schedules.listOccurrences.execute(
				context.req.param('bookId'),
				context.req.param('scheduleId')
			);

			return jsonResponse(paginated(list, context.req.query()));
		})
		.post('/books/:bookId/schedules/:scheduleId/occurrences', async context => {
			const { maxOccurrences, throughDate } = await readJsonBody(context.req.raw, generateOccurrencesSchema);

			return jsonResponse(
				schedules.generateOccurrences.execute(
					context.req.param('bookId'),
					context.req.param('scheduleId'),
					throughDate,
					maxOccurrences
				)
			);
		})
		.all('/books/:bookId/schedules/:scheduleId/occurrences', () => methodNotAllowed('GET, POST'));

	routes
		.post('/books/:bookId/schedule-occurrences/:occurrenceId/record', async context => {
			const { transactionId } = await readJsonBody(context.req.raw, recordOccurrenceSchema);

			return jsonResponse(
				schedules.recordOccurrence.execute(
					context.req.param('bookId'),
					context.req.param('occurrenceId'),
					transactionId
				)
			);
		})
		.all('/books/:bookId/schedule-occurrences/:occurrenceId/record', () => methodNotAllowed('POST'));

	return routes;
}

export { createScheduleRoutes };
