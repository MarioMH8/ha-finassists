import type { BudgetActualsQuery, BudgetReport, BudgetRepository } from '@modules/budgets/domain';
import { BudgetNotFoundError } from '@modules/budgets/domain';

interface GetBudgetReportInput {
	bookId: string;
	id: string;
}

class GetBudgetReport {
	constructor(
		private readonly budgets: BudgetRepository,
		private readonly actuals: BudgetActualsQuery
	) {}

	execute(input: GetBudgetReportInput): BudgetReport {
		const budget = this.budgets.find({ bookId: input.bookId, id: input.id });
		if (!budget) {
			throw new BudgetNotFoundError();
		}

		return budget.report(this.actuals.actualMinor(budget));
	}
}

export { GetBudgetReport, type GetBudgetReportInput };
