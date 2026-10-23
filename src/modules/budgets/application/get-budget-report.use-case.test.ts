import { describe, expect, it } from 'bun:test';

import { BudgetNotFoundError } from '../domain';
import { BudgetMother } from '../domain/budget.mother';
import { MockBudgetActualsQuery } from '../infrastructure/queries/mock-budget-actuals.query';
import { MockBudgetRepository } from '../infrastructure/repositories/mock-budget.repository';
import { GetBudgetReport } from './get-budget-report.use-case';

describe('GetBudgetReport', () => {
	describe('execute', () => {
		it('should report the planned, actual and remaining amounts of the budget', () => {
			const budgets = new MockBudgetRepository();
			const actuals = new MockBudgetActualsQuery();
			const budget = BudgetMother.create({ plannedMinor: 1000 });
			budgets.shouldFind(budget);
			actuals.shouldReturnActual(350n);
			const useCase = new GetBudgetReport(budgets, actuals);

			const report = useCase.execute({ bookId: 'book-1', id: 'budget-1' });

			expect(report).toEqual({ actualMinor: 350, budget, remainingMinor: 650 });
			budgets.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'budget-1' });
			actuals.assertActualMinorHasBeenCalledWith(budget);
		});

		it('should fail when the budget does not exist in the book', () => {
			const budgets = new MockBudgetRepository();
			const actuals = new MockBudgetActualsQuery();
			const useCase = new GetBudgetReport(budgets, actuals);

			expect(() => useCase.execute({ bookId: 'book-1', id: 'missing' })).toThrow(BudgetNotFoundError);
		});
	});
});
