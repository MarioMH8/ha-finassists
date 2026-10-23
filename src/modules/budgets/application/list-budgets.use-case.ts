import type { Budget, BudgetRepository } from '../domain';

interface ListBudgetsInput {
	accountId?: string;
	bookId: string;
}

class ListBudgets {
	constructor(private readonly budgets: BudgetRepository) {}

	execute(input: ListBudgetsInput): Budget[] {
		return this.budgets.list(input.bookId, input.accountId);
	}
}

export { ListBudgets, type ListBudgetsInput };
