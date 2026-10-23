import { expect, mock } from 'bun:test';

import type { Budget, BudgetCriteria, BudgetDeleteCriteria, BudgetRepository } from '../../domain';

export class MockBudgetRepository implements BudgetRepository {
	private readonly deleteMock = mock<BudgetRepository['delete']>(() => false);
	private readonly findMock = mock<BudgetRepository['find']>();
	private readonly saveMock = mock<BudgetRepository['save']>();
	private readonly searchMock = mock<BudgetRepository['search']>(() => []);

	assertDeleteHasBeenCalledWith(criteria: BudgetDeleteCriteria): void {
		expect(this.deleteMock).toHaveBeenCalledWith(criteria);
	}

	assertFindHasBeenCalledWith(criteria: BudgetCriteria): void {
		expect(this.findMock).toHaveBeenCalledWith(criteria);
	}

	assertSaveHasBeenCalledWith(budget: Budget): void {
		expect(this.saveMock).toHaveBeenCalledWith(budget);
	}

	assertSaveHasNotBeenCalled(): void {
		expect(this.saveMock).not.toHaveBeenCalled();
	}

	assertSearchHasBeenCalledWith(criteria?: BudgetCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(...(criteria === undefined ? [] : [criteria]));
	}

	delete(criteria: BudgetDeleteCriteria): boolean {
		return this.deleteMock(criteria);
	}

	find(criteria: BudgetCriteria): Budget | undefined {
		return this.findMock(criteria);
	}

	save(budget: Budget): void {
		this.saveMock(budget);
	}

	search(criteria?: BudgetCriteria): Budget[] {
		return criteria === undefined ? this.searchMock() : this.searchMock(criteria);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockReturnValue(isDeleted);
	}

	shouldFind(budget: Budget | undefined): void {
		this.findMock.mockReturnValue(budget);
	}

	shouldSearch(budgets: Budget[]): void {
		this.searchMock.mockReturnValue(budgets);
	}
}
