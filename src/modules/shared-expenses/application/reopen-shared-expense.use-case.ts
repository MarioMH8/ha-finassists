import type { SharedExpenseRepository } from '@modules/shared-expenses/domain';

class ReopenSharedExpense {
	constructor(private readonly expenses: SharedExpenseRepository) {}

	execute(bookId: string, expenseId: string): boolean {
		return this.expenses.reopen(bookId, expenseId);
	}
}

export { ReopenSharedExpense };
