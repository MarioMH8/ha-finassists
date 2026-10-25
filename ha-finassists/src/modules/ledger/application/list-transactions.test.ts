import { describe, expect, it } from 'bun:test';

import { TransactionMother } from '../domain/transaction.mother';
import { MockLedgerRepository } from '../infrastructure/repositories/mock-ledger.repository';
import { ListTransactions } from './list-transactions';

describe('ListTransactions', () => {
	it('delegates the criteria to the repository', async () => {
		const repository = new MockLedgerRepository();
		const page = { items: [TransactionMother.create()], total: 1 };
		repository.shouldSearch(page);

		const result = await new ListTransactions(repository).execute({ kind: 'expense', limit: 10 });

		expect(result).toEqual(page);
		repository.assertSearchHasBeenCalledWith({ kind: 'expense', limit: 10 });
	});
});
