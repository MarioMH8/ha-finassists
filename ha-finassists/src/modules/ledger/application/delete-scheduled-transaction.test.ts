import { ScheduledTransactionNotFoundError } from '@modules/ledger/domain';
import { MockScheduledTransactionRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-transaction.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { DeleteScheduledTransaction } from './delete-scheduled-transaction';

describe('DeleteScheduledTransaction', () => {
	let repository: MockScheduledTransactionRepository;
	let useCase: DeleteScheduledTransaction;

	beforeEach(() => {
		repository = new MockScheduledTransactionRepository();
		useCase = new DeleteScheduledTransaction(repository);
	});

	it('deletes an existing schedule', async () => {
		repository.shouldDelete(true);

		await useCase.execute({ id: 'schedule-1' });

		repository.assertDeleteHasBeenCalledWith('schedule-1');
	});

	it('fails when the schedule does not exist', async () => {
		repository.shouldDelete(false);

		let failure: unknown;
		try {
			await useCase.execute({ id: 'missing' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(ScheduledTransactionNotFoundError);
	});
});
