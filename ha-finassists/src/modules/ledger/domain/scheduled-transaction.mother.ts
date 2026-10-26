import type { CreateScheduledTransactionProperties, ScheduledTransactionProperties } from './scheduled-transaction';
import { ScheduledTransaction } from './scheduled-transaction';

class ScheduledTransactionMother {
	static create(overrides: Partial<CreateScheduledTransactionProperties> = {}): ScheduledTransaction {
		return ScheduledTransaction.create({
			amountMinor: 1250,
			createdAt: '2026-05-01T10:00:00.000Z',
			createdBy: 'user-1',
			currencyCode: 'EUR',
			description: 'Rent',
			frequency: 'monthly',
			id: 'schedule-1',
			kind: 'expense',
			startDate: '2026-05-01',
			...overrides,
		});
	}

	static restore(overrides: Partial<ScheduledTransactionProperties> = {}): ScheduledTransaction {
		return ScheduledTransaction.restore({
			amountMinor: 1250,
			categoryId: null,
			createdAt: '2026-05-01T10:00:00.000Z',
			createdBy: 'user-1',
			currencyCode: 'EUR',
			description: 'Rent',
			endDate: null,
			frequency: 'monthly',
			id: 'schedule-1',
			interval: 1,
			kind: 'expense',
			nextDueDate: '2026-05-01',
			occurrenceNumber: 0,
			postingMode: 'automatic',
			startDate: '2026-05-01',
			status: 'active',
			version: 0,
			...overrides,
		});
	}
}

export { ScheduledTransactionMother };
