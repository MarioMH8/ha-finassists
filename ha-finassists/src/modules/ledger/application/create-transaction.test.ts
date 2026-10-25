import { beforeEach, describe, expect, it } from 'bun:test';

import { TransactionAmountInvalidError } from '../domain';
import { MockLedgerRepository } from '../infrastructure/repositories/mock-ledger.repository';
import { CreateTransaction } from './create-transaction';

describe('CreateTransaction', () => {
	let repository: MockLedgerRepository;
	let useCase: CreateTransaction;

	beforeEach(() => {
		repository = new MockLedgerRepository();
		useCase = new CreateTransaction(repository, 'EUR');
	});

	it('saves the transaction with the configured currency and actor', async () => {
		const transaction = await useCase.execute({
			actorId: 'user-1',
			amountMinor: 1250,
			description: 'Groceries',
			kind: 'expense',
			transactionDate: '2026-05-15',
		});

		expect(transaction.currencyCode).toBe('EUR');
		expect(transaction.actorId).toBe('user-1');
		expect(transaction.description).toBe('Groceries');
		expect(transaction.id).not.toBe('');
		repository.assertSaveHasBeenCalledWith(transaction);
	});

	it('defaults the description to an empty string', async () => {
		const transaction = await useCase.execute({
			actorId: null,
			amountMinor: 500,
			kind: 'income',
			transactionDate: '2026-05-01',
		});

		expect(transaction.description).toBe('');
		expect(transaction.actorId).toBeNull();
	});

	it('does not save an invalid transaction', async () => {
		let failure: unknown;
		try {
			await useCase.execute({
				actorId: 'user-1',
				amountMinor: 0,
				kind: 'expense',
				transactionDate: '2026-05-15',
			});
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(TransactionAmountInvalidError);
		expect(repository.saved).toHaveLength(0);
	});

	it('rejects an unsupported currency', () => {
		expect(() => new CreateTransaction(repository, 'euro')).toThrow();
	});
});
