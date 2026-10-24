import { TransferAccountsMustDifferError } from '@modules/ledger/domain';
import { FinancialTransactionMother } from '@modules/ledger/domain/transaction.mother';
import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { describe, expect, it } from 'bun:test';

import { CreateTransfer } from './create-transfer.use-case';

describe('CreateTransfer', () => {
	describe('execute', () => {
		it('should create the transfer in the repository and return both legs', () => {
			const repository = new MockLedgerRepository();
			const transfer = {
				from: FinancialTransactionMother.create({ amountMinor: -500, id: 'from', transferId: 'transfer-1' }),
				id: 'transfer-1',
				to: FinancialTransactionMother.create({
					accountId: 'account-2',
					amountMinor: 500,
					id: 'to',
					transferId: 'transfer-1',
				}),
			};
			repository.shouldCreateTransfer(transfer);
			const useCase = new CreateTransfer(repository);
			const input = {
				amountMinor: 500,
				bookId: 'book-1',
				fromAccountId: 'account-1',
				toAccountId: 'account-2',
				transactionDate: '2026-03-01',
			};

			const created = useCase.execute(input);

			expect(created).toBe(transfer);
			repository.assertCreateTransferHasBeenCalledWith(input);
		});

		it('should throw the validation error without creating when the accounts are the same', () => {
			const repository = new MockLedgerRepository();
			const useCase = new CreateTransfer(repository);

			expect(() =>
				useCase.execute({
					amountMinor: 500,
					bookId: 'book-1',
					fromAccountId: 'account-1',
					toAccountId: 'account-1',
					transactionDate: '2026-03-01',
				})
			).toThrow(TransferAccountsMustDifferError);
			repository.assertCreateTransferHasNotBeenCalled();
		});
	});
});
