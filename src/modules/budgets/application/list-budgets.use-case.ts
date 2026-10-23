import type { Budget, BudgetRepository } from '../domain';

interface ListBudgetsInput {
	accountId?: string;
	bookId: string;
}

class ListBudgets {
	constructor(private readonly budgets: BudgetRepository) {}

	execute(input: ListBudgetsInput): Budget[] {
		return this.budgets.search({
			bookId: input.bookId,
			...(input.accountId !== undefined && { accountId: input.accountId }),
		});
	}
}

export { ListBudgets, type ListBudgetsInput };
