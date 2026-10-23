import type { SharedExpenseRepository } from '../domain';

class CloseSharedExpense {
	constructor(private readonly expenses: SharedExpenseRepository) {}

	execute(bookId: string, expenseId: string, closedAt = new Date().toISOString()): boolean {
		return this.expenses.close(bookId, expenseId, closedAt);
	}
}

export { CloseSharedExpense };
