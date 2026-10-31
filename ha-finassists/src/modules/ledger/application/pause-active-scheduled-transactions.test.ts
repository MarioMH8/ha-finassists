import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { MockScheduledTransactionRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-transaction.repository';
import { describe, expect, it } from 'bun:test';

import { PauseActiveScheduledTransactions } from './pause-active-scheduled-transactions';

describe('PauseActiveScheduledTransactions', () => {
	it('pauses active schedules and skips paused or completed ones', async () => {
		const repository = new MockScheduledTransactionRepository();
		repository.shouldSearch({
			items: [
				ScheduledTransactionMother.restore({ id: 'active', status: 'active' }),
				ScheduledTransactionMother.restore({ id: 'paused', status: 'paused' }),
				ScheduledTransactionMother.restore({
					id: 'completed',
					nextDueDate: null,
					status: 'completed',
				}),
			],
			total: 3,
		});
		repository.shouldUpdate(true);

		expect(await new PauseActiveScheduledTransactions(repository).execute()).toBe(1);
		expect(repository.searchedCriteria).toEqual([{ limit: 1000, status: 'active' }]);
		expect(repository.updated).toHaveLength(1);
		expect(repository.updated[0]).toMatchObject({
			id: 'active',
			status: 'paused',
			version: 1,
		});
	});

	it('counts only schedules the repository actually updated', async () => {
		const repository = new MockScheduledTransactionRepository();
		repository.shouldSearch({
			items: [
				ScheduledTransactionMother.restore({ id: 'active', status: 'active' }),
				ScheduledTransactionMother.restore({ id: 'conflict', status: 'active' }),
			],
			total: 2,
		});
		repository.shouldUpdate(false);

		expect(await new PauseActiveScheduledTransactions(repository).execute()).toBe(0);
		expect(repository.updated).toHaveLength(2);
	});

	it('does nothing when there are no active schedules', async () => {
		const repository = new MockScheduledTransactionRepository();
		repository.shouldSearch({ items: [], total: 0 });

		expect(await new PauseActiveScheduledTransactions(repository).execute()).toBe(0);
		expect(repository.updated).toEqual([]);
	});
});
