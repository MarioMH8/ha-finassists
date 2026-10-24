import { TransactionDateFormatInvalidError } from '@modules/ledger/domain';
import { FinancialTransactionMother } from '@modules/ledger/domain/transaction.mother';
import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { describe, expect, it } from 'bun:test';

import { CreateTransaction } from './create-transaction.use-case';

describe('CreateTransaction', () => {
	describe('execute', () => {
		it('should create the transaction in the repository and return it', () => {
			const repository = new MockLedgerRepository();
			const created = FinancialTransactionMother.create();
			repository.shouldCreate(created);
			const useCase = new CreateTransaction(repository);
			const input = {
				accountId: 'account-1',
				amountMinor: -1250,
				bookId: 'book-1',
				transactionDate: '2026-03-01',
			};

			const transaction = useCase.execute(input);

			expect(transaction).toBe(created);
			repository.assertCreateHasBeenCalledWith(input);
		});

		it('should throw the validation error without creating when the input is invalid', () => {
			const repository = new MockLedgerRepository();
			const useCase = new CreateTransaction(repository);

			expect(() =>
				useCase.execute({
					accountId: 'account-1',
					amountMinor: -1250,
					bookId: 'book-1',
					transactionDate: '01/03/2026',
				})
			).toThrow(TransactionDateFormatInvalidError);
			repository.assertCreateHasNotBeenCalled();
		});
	});
});
