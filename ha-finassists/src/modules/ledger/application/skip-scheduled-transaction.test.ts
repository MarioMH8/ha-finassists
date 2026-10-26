import {
	ScheduledTransactionNotDueError,
	ScheduledTransactionNotFoundError,
	ScheduledTransactionVersionConflictError,
} from '@modules/ledger/domain';
import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { MockScheduledTransactionRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-transaction.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { SkipScheduledTransaction } from './skip-scheduled-transaction';

describe('SkipScheduledTransaction', () => {
	let repository: MockScheduledTransactionRepository;
	let useCase: SkipScheduledTransaction;

	beforeEach(() => {
		repository = new MockScheduledTransactionRepository();
		useCase = new SkipScheduledTransaction(repository);
	});

	it('advances the schedule without creating a transaction', async () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-05-01' });
		repository.shouldFind(schedule);
		repository.shouldUpdate(true);

		const skipped = await useCase.execute({ id: schedule.id, today: '2026-05-01' });

		expect(skipped).toMatchObject({
			nextDueDate: '2026-06-01',
			occurrenceNumber: 1,
			status: 'active',
			version: 1,
		});
		expect(repository.updated).toEqual([skipped]);
	});

	it('completes a one-time schedule', async () => {
		const schedule = ScheduledTransactionMother.create({
			frequency: 'once',
			startDate: '2026-05-01',
		});
		repository.shouldFind(schedule);
		repository.shouldUpdate(true);

		const skipped = await useCase.execute({ id: schedule.id, today: '2026-05-01' });

		expect(skipped).toMatchObject({
			nextDueDate: null,
			status: 'completed',
		});
	});

	it('rejects a future, missing or stale schedule', async () => {
		const future = ScheduledTransactionMother.create({ startDate: '2026-05-01' });
		repository.shouldFind(future);
		let futureFailure: unknown;
		try {
			await useCase.execute({ id: future.id, today: '2026-04-30' });
		} catch (error) {
			futureFailure = error;
		}
		expect(futureFailure).toBeInstanceOf(ScheduledTransactionNotDueError);

		repository.shouldFind(undefined);
		let missingFailure: unknown;
		try {
			await useCase.execute({ id: 'missing', today: '2026-05-01' });
		} catch (error) {
			missingFailure = error;
		}
		expect(missingFailure).toBeInstanceOf(ScheduledTransactionNotFoundError);

		repository.shouldFind(future);
		repository.shouldUpdate(false);
		let staleFailure: unknown;
		try {
			await useCase.execute({ id: future.id, today: '2026-05-01' });
		} catch (error) {
			staleFailure = error;
		}
		expect(staleFailure).toBeInstanceOf(ScheduledTransactionVersionConflictError);
	});
});
