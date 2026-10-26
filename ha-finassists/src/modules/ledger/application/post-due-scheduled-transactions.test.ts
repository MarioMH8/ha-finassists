import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { MockScheduledPostingRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-posting.repository';
import { describe, expect, it } from 'bun:test';

import { PostDueScheduledTransactions } from './post-due-scheduled-transactions';

const NOW = '2026-04-15T10:00:00.000Z';

describe('PostDueScheduledTransactions', () => {
	it('posts every due occurrence with the schedule creator as actor', async () => {
		const repository = new MockScheduledPostingRepository();
		const schedule = ScheduledTransactionMother.create({
			createdBy: 'user-1',
			id: 'schedule-1',
			startDate: '2026-01-01',
		});
		repository.shouldSearch({ items: [schedule], total: 1 });

		const result = await new PostDueScheduledTransactions(
			repository,
			() => '2026-04-15',
			() => NOW
		).execute();

		expect(result).toEqual({ posted: 4, schedules: 1 });
		expect(repository.searchedCriteria).toEqual([
			{
				dueThrough: '2026-04-15',
				limit: 1000,
				postingMode: 'automatic',
				status: 'active',
			},
		]);
		expect(repository.posted.map(posting => posting.transaction.transactionDate)).toEqual([
			'2026-01-01',
			'2026-02-01',
			'2026-03-01',
			'2026-04-01',
		]);
		expect(repository.posted.every(posting => posting.transaction.actorId === 'user-1')).toBe(true);
		expect(repository.posted.every(posting => posting.transaction.createdAt === NOW)).toBe(true);
		expect(repository.posted.map(posting => posting.expectedVersion)).toEqual([0, 1, 2, 3]);
		expect(repository.posted.map(posting => posting.occurrenceNumber)).toEqual([0, 1, 2, 3]);
		expect(repository.posted.at(-1)?.schedule).toMatchObject({
			nextDueDate: '2026-05-01',
			occurrenceNumber: 4,
			status: 'active',
			version: 4,
		});
	});

	it('stops at the per-schedule limit', async () => {
		const repository = new MockScheduledPostingRepository();
		repository.shouldSearch({
			items: [ScheduledTransactionMother.create({ id: 'schedule-1', startDate: '2026-01-01' })],
			total: 1,
		});

		const result = await new PostDueScheduledTransactions(
			repository,
			() => '2026-04-15',
			() => NOW,
			2
		).execute();

		expect(result).toEqual({ posted: 2, schedules: 1 });
		expect(repository.posted.at(-1)?.schedule).toMatchObject({
			nextDueDate: '2026-03-01',
			occurrenceNumber: 2,
			version: 2,
		});
	});

	it('stops on a concurrent change and returns zero when nothing is due', async () => {
		const repository = new MockScheduledPostingRepository();
		repository.shouldSearch({
			items: [ScheduledTransactionMother.create({ id: 'schedule-1', startDate: '2026-01-01' })],
			total: 1,
		});
		repository.shouldPost(false);

		const conflicting = await new PostDueScheduledTransactions(
			repository,
			() => '2026-04-15',
			() => NOW
		).execute();

		expect(conflicting).toEqual({ posted: 0, schedules: 1 });

		repository.shouldSearch({ items: [], total: 0 });
		const empty = await new PostDueScheduledTransactions(
			repository,
			() => '2026-04-15',
			() => NOW
		).execute();

		expect(empty).toEqual({ posted: 0, schedules: 0 });
	});

	it('uses null attribution when the creator is unknown', async () => {
		const repository = new MockScheduledPostingRepository();
		repository.shouldSearch({
			items: [
				ScheduledTransactionMother.create({
					createdBy: null,
					frequency: 'once',
					startDate: '2026-01-01',
				}),
			],
			total: 1,
		});

		await new PostDueScheduledTransactions(
			repository,
			() => '2026-01-01',
			() => NOW
		).execute();

		expect(repository.posted[0]?.transaction.actorId).toBeNull();
	});
});
