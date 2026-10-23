import type { Budget } from '../budget';

interface BudgetCriteria {
	accountId?: string;
	bookId?: string;
	categoryId?: null | string;
	classId?: null | string;
	currencyCode?: string;
	id?: string;
	name?: string;
	periodEnd?: string;
	periodStart?: string;
	plannedMinor?: number;
}

interface BudgetDeleteCriteria {
	bookId: string;
	id: string;
}

interface BudgetRepository {
	delete(criteria: BudgetDeleteCriteria): boolean;
	find(criteria: BudgetCriteria): Budget | undefined;
	save(budget: Budget): void;
	search(criteria?: BudgetCriteria): Budget[];
}

interface BudgetActualsQuery {
	actualMinor(budget: Budget): bigint;
}

export type { BudgetActualsQuery, BudgetCriteria, BudgetDeleteCriteria, BudgetRepository };
