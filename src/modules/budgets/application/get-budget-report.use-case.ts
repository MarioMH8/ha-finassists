import type { BudgetReport, BudgetRepository } from '../domain';
import { safeMinorUnitsFromBigInt } from '../domain';

interface GetBudgetReportInput {
	bookId: string;
	id: string;
}

class GetBudgetReport {
	constructor(private readonly budgets: BudgetRepository) {}

	execute(input: GetBudgetReportInput): BudgetReport {
		const budget = this.budgets.find(input.bookId, input.id);
		if (!budget) {
			throw new Error('Budget not found');
		}

		const actualMinor = this.budgets.actualMinor(budget);

		return {
			actualMinor,
			budget,
			remainingMinor: safeMinorUnitsFromBigInt(
				BigInt(budget.plannedMinor) - BigInt(actualMinor),
				'Budget remaining amount'
			),
		};
	}
}

export { GetBudgetReport, type GetBudgetReportInput };
