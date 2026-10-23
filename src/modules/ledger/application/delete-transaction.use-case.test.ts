import { describe, expect, it } from 'bun:test';

import { FinancialTransactionMother } from '../domain/transaction.mother';
import { MockLedgerRepository } from '../infrastructure/repositories/mock-ledger.repository';
import { DeleteTransaction } from './delete-transaction.use-case';

describe('DeleteTransaction', () => {
	describe('execute', () => {
		it('should remove an existing unreconciled transaction', () => {
			const repository = new MockLedgerRepository();
			repository.shouldFind(FinancialTransactionMother.create({ status: 'cleared' }));
			repository.shouldRemove(true);
			const useCase = new DeleteTransaction(repository);

			expect(useCase.execute('book-1', 'transaction-1')).toBe(true);
			repository.assertFindHasBeenCalledWith('book-1', 'transaction-1');
			repository.assertRemoveHasBeenCalledWith('book-1', 'transaction-1');
		});

		it('should return false when the repository does not remove the transaction', () => {
			const repository = new MockLedgerRepository();
			repository.shouldFind(FinancialTransactionMother.create());
			const useCase = new DeleteTransaction(repository);

			expect(useCase.execute('book-1', 'transaction-1')).toBe(false);
			repository.assertRemoveHasBeenCalledWith('book-1', 'transaction-1');
		});

		it('should return false without removing when the transaction does not exist', () => {
			const repository = new MockLedgerRepository();
			const useCase = new DeleteTransaction(repository);

			expect(useCase.execute('book-1', 'missing')).toBe(false);
			repository.assertRemoveHasNotBeenCalled();
		});

		it('should refuse to remove a reconciled transaction', () => {
			const repository = new MockLedgerRepository();
			repository.shouldFind(FinancialTransactionMother.create({ status: 'reconciled' }));
			repository.shouldRemove(true);
			const useCase = new DeleteTransaction(repository);

			expect(useCase.execute('book-1', 'transaction-1')).toBe(false);
			repository.assertRemoveHasNotBeenCalled();
		});
	});
});
