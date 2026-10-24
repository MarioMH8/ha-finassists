import type {
	ListSharedExpensesOptions,
	SharedExpense,
	SharedExpenseRepository,
} from '@modules/shared-expenses/domain';

interface ListSharedExpensesInput extends ListSharedExpensesOptions {
	bookId: string;
}

class ListSharedExpenses {
	constructor(private readonly expenses: SharedExpenseRepository) {}

	execute(input: ListSharedExpensesInput): SharedExpense[] {
		return this.expenses.list(input.bookId, input);
	}
}

export { ListSharedExpenses, type ListSharedExpensesInput };
