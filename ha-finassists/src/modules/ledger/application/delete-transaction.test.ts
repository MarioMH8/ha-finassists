import { TransactionNotFoundError } from '@modules/ledger/domain';
import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { DeleteTransaction } from './delete-transaction';

describe('DeleteTransaction', () => {
	let repository: MockLedgerRepository;
	let useCase: DeleteTransaction;

	beforeEach(() => {
		repository = new MockLedgerRepository();
		useCase = new DeleteTransaction(repository);
	});

	it('deletes the transaction by id', async () => {
		repository.shouldDelete(true);

		await useCase.execute({ id: 'transaction-1' });

		repository.assertDeleteHasBeenCalledWith({ id: 'transaction-1' });
	});

	it('fails when the transaction does not exist', async () => {
		repository.shouldDelete(false);

		let failure: unknown;
		try {
			await useCase.execute({ id: 'missing' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(TransactionNotFoundError);
		expect((failure as Error).message).toContain('not found');
	});
});
