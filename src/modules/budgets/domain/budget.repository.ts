import type { Budget } from './budget';

interface BudgetRepository {
	/**
	 * Returns positive spending in minor units from cleared and reconciled ledger entries.
	 */
	actualMinor(budget: Budget): number;
	/**
	 * Creates a budget or throws BudgetPeriodOverlapError for an inclusive period collision.
	 */
	create(budget: Budget): Budget;
	find(bookId: string, id: string): Budget | undefined;
	list(bookId: string, accountId?: string): Budget[];
}

export type { BudgetRepository };
