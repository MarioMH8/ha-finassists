import type { SharedExpenseRepository } from '../domain';

class ReopenSharedExpense {
	constructor(private readonly expenses: SharedExpenseRepository) {}

	execute(bookId: string, expenseId: string): boolean {
		return this.expenses.reopen(bookId, expenseId);
	}
}

export { ReopenSharedExpense };
