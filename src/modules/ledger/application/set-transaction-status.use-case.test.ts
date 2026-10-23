import { describe, expect, it } from 'bun:test';

import type { TransactionStatus } from '../domain';
import { FinancialTransactionMother } from '../domain/transaction.mother';
import { MockLedgerRepository } from '../infrastructure/repositories/mock-ledger.repository';
import { SetTransactionStatus } from './set-transaction-status.use-case';

const ALLOWED_TRANSITIONS: [TransactionStatus, TransactionStatus][] = [
	['uncleared', 'cleared'],
	['uncleared', 'reconciled'],
	['cleared', 'uncleared'],
	['cleared', 'reconciled'],
	['reconciled', 'cleared'],
];

const FORBIDDEN_TRANSITIONS: [TransactionStatus, TransactionStatus][] = [
	['uncleared', 'uncleared'],
	['cleared', 'cleared'],
	['reconciled', 'reconciled'],
	['reconciled', 'uncleared'],
];

describe('SetTransactionStatus', () => {
	describe('execute', () => {
		it.each(ALLOWED_TRANSITIONS)('should allow moving from %s to %s', (current, next) => {
			const repository = new MockLedgerRepository();
			repository.shouldFind(FinancialTransactionMother.create({ status: current }));
			repository.shouldSetStatus(true);
			const useCase = new SetTransactionStatus(repository);

			expect(useCase.execute('book-1', 'transaction-1', next)).toBe(true);
			repository.assertSetStatusHasBeenCalledWith('book-1', 'transaction-1', next);
		});

		it.each(FORBIDDEN_TRANSITIONS)('should reject moving from %s to %s', (current, next) => {
			const repository = new MockLedgerRepository();
			repository.shouldFind(FinancialTransactionMother.create({ status: current }));
			repository.shouldSetStatus(true);
			const useCase = new SetTransactionStatus(repository);

			expect(useCase.execute('book-1', 'transaction-1', next)).toBe(false);
			repository.assertSetStatusHasNotBeenCalled();
		});

		it('should return false without changing the status when the transaction does not exist', () => {
			const repository = new MockLedgerRepository();
			const useCase = new SetTransactionStatus(repository);

			expect(useCase.execute('book-1', 'missing', 'cleared')).toBe(false);
			repository.assertSetStatusHasNotBeenCalled();
		});

		it('should return false when the repository does not update the status', () => {
			const repository = new MockLedgerRepository();
			repository.shouldFind(FinancialTransactionMother.create());
			const useCase = new SetTransactionStatus(repository);

			expect(useCase.execute('book-1', 'transaction-1', 'cleared')).toBe(false);
			repository.assertSetStatusHasBeenCalledWith('book-1', 'transaction-1', 'cleared');
		});
	});
});
