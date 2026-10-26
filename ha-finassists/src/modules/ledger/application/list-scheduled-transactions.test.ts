import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { MockScheduledTransactionRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-transaction.repository';
import { describe, expect, it } from 'bun:test';

import { ListScheduledTransactions } from './list-scheduled-transactions';

describe('ListScheduledTransactions', () => {
	it('delegates the criteria to the repository', async () => {
		const repository = new MockScheduledTransactionRepository();
		const schedule = ScheduledTransactionMother.create();
		repository.shouldSearch({ items: [schedule], total: 1 });
		const criteria = { kind: 'expense' as const, status: 'active' as const };

		const page = await new ListScheduledTransactions(repository).execute(criteria);

		expect(page.items).toEqual([schedule]);
		expect(repository.searchedCriteria).toEqual([criteria]);
	});
});
