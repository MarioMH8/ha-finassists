import { FinancialTransactionMother } from '@modules/ledger/domain/transaction.mother';
import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { describe, expect, it } from 'bun:test';

import { ListTransactions } from './list-transactions.use-case';

describe('ListTransactions', () => {
	describe('execute', () => {
		it('should return the transactions of the account in the book', () => {
			const repository = new MockLedgerRepository();
			const transactions = [FinancialTransactionMother.create()];
			repository.shouldList(transactions);
			const useCase = new ListTransactions(repository);

			expect(useCase.execute('book-1', 'account-1')).toEqual(transactions);
			repository.assertListHasBeenCalledWith('book-1', 'account-1');
		});

		it('should return an empty list when the account has no transactions', () => {
			const repository = new MockLedgerRepository();
			const useCase = new ListTransactions(repository);

			expect(useCase.execute('book-1', 'account-1')).toEqual([]);
		});
	});
});
