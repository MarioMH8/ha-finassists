import type { BudgetInput } from './budget';
import { Budget } from './budget';

export class BudgetMother {
	static create(overrides: Partial<BudgetInput> = {}): Budget {
		return Budget.create({
			accountId: 'account-1',
			bookId: 'book-1',
			currencyCode: 'EUR',
			id: 'budget-1',
			name: 'March',
			periodEnd: '2026-03-31',
			periodStart: '2026-03-01',
			plannedMinor: 1000,
			...overrides,
		});
	}
}
