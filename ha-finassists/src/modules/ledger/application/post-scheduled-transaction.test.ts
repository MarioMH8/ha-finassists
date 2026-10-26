import {
	ScheduledTransactionNotDueError,
	ScheduledTransactionNotFoundError,
	ScheduledTransactionVersionConflictError,
} from '@modules/ledger/domain';
import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { MockScheduledPostingRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-posting.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { PostScheduledTransaction } from './post-scheduled-transaction';

describe('PostScheduledTransaction', () => {
	let repository: MockScheduledPostingRepository;
	let useCase: PostScheduledTransaction;

	beforeEach(() => {
		repository = new MockScheduledPostingRepository();
		useCase = new PostScheduledTransaction(repository);
	});

	it('posts the next due occurrence and advances the schedule', async () => {
		const schedule = ScheduledTransactionMother.create({
			categoryId: 'category-1',
			startDate: '2026-05-01',
		});
		repository.shouldFind(schedule);

		const result = await useCase.execute({
			actorId: 'user-2',
			id: schedule.id,
			today: '2026-05-01',
		});

		expect(result.transaction).toMatchObject({
			actorId: 'user-2',
			amountMinor: 1250,
			categoryId: 'category-1',
			currencyCode: 'EUR',
			description: 'Rent',
			kind: 'expense',
			transactionDate: '2026-05-01',
		});
		expect(result.transaction.id).not.toBe('');
		expect(result.schedule).toMatchObject({
			nextDueDate: '2026-06-01',
			occurrenceNumber: 1,
			status: 'active',
			version: 1,
		});
		expect(repository.posted[0]).toMatchObject({
			expectedVersion: 0,
			occurrenceNumber: 0,
			schedule: result.schedule,
			transaction: result.transaction,
		});
	});

	it('completes a one-time schedule', async () => {
		const schedule = ScheduledTransactionMother.create({
			frequency: 'once',
			startDate: '2026-05-01',
		});
		repository.shouldFind(schedule);

		const result = await useCase.execute({
			actorId: 'user-2',
			id: schedule.id,
			today: '2026-05-01',
		});

		expect(result.schedule).toMatchObject({
			nextDueDate: null,
			occurrenceNumber: 1,
			status: 'completed',
		});
	});

	it('rejects a future, paused or missing schedule', async () => {
		const future = ScheduledTransactionMother.create({ startDate: '2026-05-01' });
		repository.shouldFind(future);
		let futureFailure: unknown;
		try {
			await useCase.execute({ actorId: 'user-2', id: future.id, today: '2026-04-30' });
		} catch (error) {
			futureFailure = error;
		}
		expect(futureFailure).toBeInstanceOf(ScheduledTransactionNotDueError);

		const paused = ScheduledTransactionMother.create({ startDate: '2026-05-01' }).pause();
		repository.shouldFind(paused);
		let pausedFailure: unknown;
		try {
			await useCase.execute({ actorId: 'user-2', id: paused.id, today: '2026-05-01' });
		} catch (error) {
			pausedFailure = error;
		}
		expect(pausedFailure).toBeInstanceOf(ScheduledTransactionNotDueError);

		repository.shouldFind(undefined);
		let missingFailure: unknown;
		try {
			await useCase.execute({ actorId: 'user-2', id: 'missing', today: '2026-05-01' });
		} catch (error) {
			missingFailure = error;
		}
		expect(missingFailure).toBeInstanceOf(ScheduledTransactionNotFoundError);
		expect(repository.posted).toHaveLength(0);
	});

	it('reports a stale schedule version', async () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-05-01' });
		repository.shouldFind(schedule);
		repository.shouldPost(false);

		let failure: unknown;
		try {
			await useCase.execute({ actorId: 'user-2', id: schedule.id, today: '2026-05-01' });
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(ScheduledTransactionVersionConflictError);
	});
});
