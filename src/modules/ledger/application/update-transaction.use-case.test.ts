import { ReconciledTransactionBalanceChangeError } from '@modules/ledger/domain';
import { FinancialTransactionMother } from '@modules/ledger/domain/transaction.mother';
import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { describe, expect, it } from 'bun:test';

import { UpdateTransaction } from './update-transaction.use-case';

describe('UpdateTransaction', () => {
	describe('execute', () => {
		it('should persist the validated changes and return the updated transaction', () => {
			const repository = new MockLedgerRepository();
			const updated = FinancialTransactionMother.create({ memo: 'Lunch' });
			repository.shouldFind(FinancialTransactionMother.create());
			repository.shouldUpdate(updated);
			const useCase = new UpdateTransaction(repository);

			const transaction = useCase.execute('book-1', 'transaction-1', { memo: 'Lunch' });

			expect(transaction).toBe(updated);
			repository.assertUpdateHasBeenCalledWith('book-1', 'transaction-1', { memo: 'Lunch' });
		});

		it('should return undefined without updating when the transaction does not exist', () => {
			const repository = new MockLedgerRepository();
			const useCase = new UpdateTransaction(repository);

			expect(useCase.execute('book-1', 'missing', { memo: 'Lunch' })).toBeUndefined();
			repository.assertUpdateHasNotBeenCalled();
		});

		it('should throw the domain error without updating when the change is not allowed', () => {
			const repository = new MockLedgerRepository();
			repository.shouldFind(FinancialTransactionMother.create({ status: 'reconciled' }));
			const useCase = new UpdateTransaction(repository);

			expect(() => useCase.execute('book-1', 'transaction-1', { amountMinor: -2000 })).toThrow(
				ReconciledTransactionBalanceChangeError
			);
			repository.assertUpdateHasNotBeenCalled();
		});
	});
});
