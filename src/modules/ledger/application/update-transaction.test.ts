import { beforeEach, describe, expect, it } from 'bun:test';

import { TransactionAmountInvalidError, TransactionNotFoundError } from '../domain';
import { TransactionMother } from '../domain/transaction.mother';
import { MockLedgerRepository } from '../infrastructure/repositories/mock-ledger.repository';
import { UpdateTransaction } from './update-transaction';

describe('UpdateTransaction', () => {
	let repository: MockLedgerRepository;
	let useCase: UpdateTransaction;

	beforeEach(() => {
		repository = new MockLedgerRepository();
		useCase = new UpdateTransaction(repository);
	});

	it('updates only the provided fields and keeps the rest', async () => {
		const existing = TransactionMother.create();
		repository.shouldFind(existing);
		repository.shouldUpdate(true);

		const updated = await useCase.execute({ amountMinor: 999, description: 'Dinner', id: existing.id });

		expect(updated).toMatchObject({
			actorId: existing.actorId,
			amountMinor: 999,
			createdAt: existing.createdAt,
			currencyCode: existing.currencyCode,
			description: 'Dinner',
			id: existing.id,
			kind: existing.kind,
			transactionDate: existing.transactionDate,
		});
	});

	it('fails when the transaction does not exist', async () => {
		repository.shouldFind(undefined);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 100, id: 'missing' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(TransactionNotFoundError);
	});

	it('rejects invalid values before updating', async () => {
		const existing = TransactionMother.create();
		repository.shouldFind(existing);

		let failure: unknown;
		try {
			await useCase.execute({ amountMinor: 0, id: existing.id });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(TransactionAmountInvalidError);
	});
});
