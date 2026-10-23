import { describe, expect, it } from 'bun:test';

import { BudgetMother } from '../domain/budget.mother';
import { MockBudgetRepository } from '../infrastructure/repositories/mock-budget.repository';
import { ListBudgets } from './list-budgets.use-case';

describe('ListBudgets', () => {
	describe('execute', () => {
		it('should search every budget of the book when no account is given', () => {
			const repository = new MockBudgetRepository();
			const budgets = [BudgetMother.create()];
			repository.shouldSearch(budgets);
			const useCase = new ListBudgets(repository);

			expect(useCase.execute({ bookId: 'book-1' })).toEqual(budgets);
			repository.assertSearchHasBeenCalledWith({ bookId: 'book-1' });
		});

		it('should narrow the search to the requested account', () => {
			const repository = new MockBudgetRepository();
			const budgets = [BudgetMother.create({ accountId: 'account-2' })];
			repository.shouldSearch(budgets);
			const useCase = new ListBudgets(repository);

			expect(useCase.execute({ accountId: 'account-2', bookId: 'book-1' })).toEqual(budgets);
			repository.assertSearchHasBeenCalledWith({ accountId: 'account-2', bookId: 'book-1' });
		});
	});
});
