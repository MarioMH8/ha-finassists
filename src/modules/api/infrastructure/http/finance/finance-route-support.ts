import type { CreateTransaction, DeleteTransaction, ListTransactions } from '@modules/ledger/application';

import { jsonResponse } from '../shared/http-responses';

interface FinanceUseCases {
	ledger: { create: CreateTransaction; delete: DeleteTransaction; list: ListTransactions };
}

interface RouteActor {
	id: string;
	kind?: 'home_assistant_integration' | 'home_assistant_user';
}

class RequestTooLargeError extends Error {}

interface FinanceEnvironment {
	Variables: { actor: RouteActor; useCases: FinanceUseCases };
}

function routeError(error: unknown): Response {
	if (error instanceof RequestTooLargeError) {
		return jsonResponse({ error: error.message }, 413);
	}
	if (error instanceof TypeError || error instanceof RangeError) {
		return jsonResponse({ error: error.message }, 400);
	}
	if (error instanceof Error) {
		if (error.name === 'SQLiteError') {
			return jsonResponse({ error: 'The request could not be completed' }, 500);
		}
		const message = error.message;
		if (/not found|does not exist/iu.test(message)) {
			return jsonResponse({ error: message }, 404);
		}
		if (/already exists|cannot/iu.test(message)) {
			return jsonResponse({ error: message }, 409);
		}

		return jsonResponse({ error: message }, 400);
	}

	return jsonResponse({ error: 'The request could not be completed' }, 500);
}

export { type FinanceEnvironment, type FinanceUseCases, RequestTooLargeError, type RouteActor, routeError };
