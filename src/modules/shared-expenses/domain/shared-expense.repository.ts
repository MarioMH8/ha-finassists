import type { SharedExpenseParticipant } from './participant';
import type { SharedExpense, SharedExpenseActor } from './shared-expense';

interface ListSharedExpensesOptions {
	includeClosed?: boolean;
}

interface ListSharedExpenseParticipantsOptions {
	includeRemoved?: boolean;
}

interface SharedExpenseRepository {
	close(bookId: string, id: string, closedAt: string): boolean;
	create(expense: SharedExpense): SharedExpense;
	createParticipant(participant: SharedExpenseParticipant): void;
	find(bookId: string, id: string): SharedExpense | undefined;
	findParticipant(bookId: string, id: string): SharedExpenseParticipant | undefined;
	list(bookId: string, options?: ListSharedExpensesOptions): SharedExpense[];
	listParticipants(bookId: string, options?: ListSharedExpenseParticipantsOptions): SharedExpenseParticipant[];
	removeParticipant(bookId: string, id: string, removedAt: string): boolean;
	reopen(bookId: string, id: string): boolean;
	settle(
		bookId: string,
		expenseId: string,
		participantId: string,
		actor: SharedExpenseActor,
		settledAt: string
	): boolean;
}

export type { ListSharedExpenseParticipantsOptions, ListSharedExpensesOptions, SharedExpenseRepository };
