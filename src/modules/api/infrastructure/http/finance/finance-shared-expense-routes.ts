import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed, noContent } from '../shared/http-responses';
import { minorUnits, readJsonBody, requiredText, stringArray } from '../shared/request-parsing';
import type { FinanceEnvironment, FinanceUseCases } from './finance-route-support';
import { isFlagEnabled, paginated } from './finance-route-support';

const newParticipantSchema = z.object({
	id: requiredText('id'),
	name: requiredText('name'),
});

const newSharedExpenseSchema = z.object({
	amountMinor: minorUnits(),
	description: requiredText('description'),
	participantIds: stringArray('participantIds'),
});

const settleSharedExpenseSchema = z.object({ participantId: requiredText('participantId') });

function createSharedExpenseRoutes(useCases: FinanceUseCases): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();
	const { sharedExpenses } = useCases;

	routes
		.get('/books/:bookId/shared-expense-participants', context => {
			const query = context.req.query();
			const participants = sharedExpenses.listParticipants.execute({
				bookId: context.req.param('bookId'),
				includeRemoved: isFlagEnabled(query, 'includeRemoved'),
			});

			return jsonResponse(paginated(participants, query));
		})
		.post('/books/:bookId/shared-expense-participants', async context => {
			const body = await readJsonBody(context.req.raw, newParticipantSchema);

			return jsonResponse(
				sharedExpenses.createParticipant.execute({ ...body, bookId: context.req.param('bookId') }),
				201
			);
		})
		.all('/books/:bookId/shared-expense-participants', () => methodNotAllowed('GET, POST'));

	routes
		.post('/books/:bookId/shared-expense-participants/:participantId/remove', context =>
			sharedExpenses.removeParticipant.execute(context.req.param('bookId'), context.req.param('participantId'))
				? noContent()
				: jsonResponse({ error: 'Participant not found or still referenced' }, 404)
		)
		.all('/books/:bookId/shared-expense-participants/:participantId/remove', () => methodNotAllowed('POST'));

	routes
		.get('/books/:bookId/shared-expenses', context => {
			const query = context.req.query();
			const expenses = sharedExpenses.list.execute({
				bookId: context.req.param('bookId'),
				includeClosed: isFlagEnabled(query, 'includeClosed'),
			});

			return jsonResponse(paginated(expenses, query));
		})
		.post('/books/:bookId/shared-expenses', async context => {
			const body = await readJsonBody(context.req.raw, newSharedExpenseSchema);
			const { actor } = context.var;

			return jsonResponse(
				sharedExpenses.create.execute({
					...body,
					actor: { id: actor.id, kind: actor.kind ?? 'home_assistant_user' },
					bookId: context.req.param('bookId'),
				}),
				201
			);
		})
		.all('/books/:bookId/shared-expenses', () => methodNotAllowed('GET, POST'));

	for (const action of ['close', 'reopen'] as const) {
		routes
			.post(`/books/:bookId/shared-expenses/:expenseId/${action}`, context =>
				sharedExpenses[action].execute(context.req.param('bookId'), context.req.param('expenseId'))
					? noContent()
					: jsonResponse({ error: 'Shared expense not found or state unchanged' }, 404)
			)
			.all(`/books/:bookId/shared-expenses/:expenseId/${action}`, () => methodNotAllowed('POST'));
	}

	routes
		.post('/books/:bookId/shared-expenses/:expenseId/settle', async context => {
			const { participantId } = await readJsonBody(context.req.raw, settleSharedExpenseSchema);
			const { actor } = context.var;
			const isSettled = sharedExpenses.settle.execute({
				actor: { id: actor.id, kind: actor.kind ?? 'home_assistant_user' },
				bookId: context.req.param('bookId'),
				expenseId: context.req.param('expenseId'),
				participantId,
			});

			return isSettled ? noContent() : jsonResponse({ error: 'Settlement not found or expense is closed' }, 409);
		})
		.all('/books/:bookId/shared-expenses/:expenseId/settle', () => methodNotAllowed('POST'));

	return routes;
}

export { createSharedExpenseRoutes };
