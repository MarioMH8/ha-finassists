import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import type {
	CreateCategory,
	CreateScheduledTransaction,
	CreateTransaction,
	DeleteCategory,
	DeleteScheduledTransaction,
	DeleteTransaction,
	DeleteTransactions,
	ListCategories,
	ListScheduledTransactions,
	ListTransactions,
	ListUpcomingScheduledTransactions,
	PostScheduledTransaction,
	SkipScheduledTransaction,
	UpdateCategory,
	UpdateScheduledTransaction,
	UpdateTransaction,
} from '@modules/ledger/application';

interface FinanceUseCases {
	ledger: {
		categories: {
			create: CreateCategory;
			delete: DeleteCategory;
			list: ListCategories;
			update: UpdateCategory;
		};
		create: CreateTransaction;
		delete: DeleteTransaction;
		deleteMany: DeleteTransactions;
		list: ListTransactions;
		scheduled: {
			create: CreateScheduledTransaction;
			delete: DeleteScheduledTransaction;
			list: ListScheduledTransactions;
			post: PostScheduledTransaction;
			skip: SkipScheduledTransaction;
			upcoming: ListUpcomingScheduledTransactions;
			update: UpdateScheduledTransaction;
		};
		update: UpdateTransaction;
	};
	today: () => string;
}

interface RouteActor {
	id: string;
	kind?: 'home_assistant_integration' | 'home_assistant_user';
}

class RequestTooLargeError extends Error {}

interface FinanceEnvironment {
	Variables: { actor: RouteActor; useCases: FinanceUseCases };
}

class FinanceRouteError {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static toResponse(error: unknown): Response {
		if (error instanceof RequestTooLargeError) {
			return HttpResponses.json({ error: error.message }, 413);
		}
		if (error instanceof TypeError || error instanceof RangeError) {
			return HttpResponses.json({ error: error.message }, 400);
		}
		if (error instanceof Error) {
			if (error.name === 'SQLiteError') {
				return HttpResponses.json({ error: 'The request could not be completed' }, 500);
			}
			const message = error.message;
			if (/not found|does not exist/iu.test(message)) {
				return HttpResponses.json({ error: message }, 404);
			}
			if (/already exists|cannot/iu.test(message)) {
				return HttpResponses.json({ error: message }, 409);
			}

			return HttpResponses.json({ error: message }, 400);
		}

		return HttpResponses.json({ error: 'The request could not be completed' }, 500);
	}
}

export { type FinanceEnvironment, FinanceRouteError, type FinanceUseCases, RequestTooLargeError, type RouteActor };
