import type { BudgetReport, BudgetRepository } from '../domain';
import { BudgetNotFoundError } from '../domain';

interface GetBudgetReportInput {
	bookId: string;
	id: string;
}

class GetBudgetReport {
	constructor(private readonly budgets: BudgetRepository) {}

	execute(input: GetBudgetReportInput): BudgetReport {
		const budget = this.budgets.find(input.bookId, input.id);
		if (!budget) {
			throw new BudgetNotFoundError();
		}

		return budget.report(BigInt(this.budgets.actualMinor(budget)));
	}
}

export { GetBudgetReport, type GetBudgetReportInput };
