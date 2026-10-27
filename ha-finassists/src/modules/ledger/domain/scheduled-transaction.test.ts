import { describe, expect, it } from 'bun:test';

import {
	ScheduledTransactionAmountInvalidError,
	ScheduledTransactionCompletedError,
	ScheduledTransactionDateRangeInvalidError,
	ScheduledTransactionFrequencyInvalidError,
	ScheduledTransactionIntervalInvalidError,
	ScheduledTransactionKindInvalidError,
	ScheduledTransactionNotDueError,
	ScheduledTransactionProjectionLimitInvalidError,
	ScheduledTransactionProjectionRangeInvalidError,
	ScheduledTransactionStateInvalidError,
	ScheduledTransactionTransitionError,
} from './scheduled-transaction.error';
import { ScheduledTransactionMother } from './scheduled-transaction.mother';

describe('ScheduledTransaction', () => {
	it('creates an active schedule due on its start date', () => {
		const schedule = ScheduledTransactionMother.create({
			description: '  Rent ',
			startDate: '2026-05-01',
		});

		expect(schedule).toMatchObject({
			categoryId: null,
			description: 'Rent',
			endDate: null,
			frequency: 'monthly',
			interval: 1,
			nextDueDate: '2026-05-01',
			occurrenceNumber: 0,
			postingMode: 'automatic',
			status: 'active',
			version: 0,
		});
	});

	it('normalizes one-time schedules to a single occurrence', () => {
		const schedule = ScheduledTransactionMother.create({
			endDate: '2026-06-01',
			frequency: 'once',
			interval: 5,
			startDate: '2026-05-01',
		});

		expect(schedule.endDate).toBeNull();
		expect(schedule.interval).toBe(1);
		expect(schedule.nextDueDate).toBe('2026-05-01');
	});

	it('rejects invalid definitions', () => {
		expect(() => ScheduledTransactionMother.create({ amountMinor: 0 })).toThrow(
			ScheduledTransactionAmountInvalidError
		);
		expect(() => ScheduledTransactionMother.create({ kind: 'transfer' as 'expense' })).toThrow(
			ScheduledTransactionKindInvalidError
		);
		expect(() => ScheduledTransactionMother.create({ currencyCode: 'eur' })).toThrow();
		expect(() => ScheduledTransactionMother.create({ startDate: '2026-02-30' })).toThrow();
		expect(() => ScheduledTransactionMother.create({ frequency: 'hourly' as 'monthly' })).toThrow(
			ScheduledTransactionFrequencyInvalidError
		);
		expect(() => ScheduledTransactionMother.create({ interval: 0 })).toThrow(
			ScheduledTransactionIntervalInvalidError
		);
		expect(() => ScheduledTransactionMother.create({ interval: 1000 })).toThrow(
			ScheduledTransactionIntervalInvalidError
		);
		expect(() => ScheduledTransactionMother.create({ endDate: '2026-04-30', startDate: '2026-05-01' })).toThrow(
			ScheduledTransactionDateRangeInvalidError
		);
		expect(() =>
			ScheduledTransactionMother.create({ description: 'x'.repeat(201), startDate: '2026-05-01' })
		).toThrow();
	});

	it('computes anchored monthly occurrences across month ends and leap years', () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-01-31' });

		expect(schedule.projectOccurrences('2026-01-31', '2026-05-31').map(occurrence => occurrence.dueDate)).toEqual([
			'2026-01-31',
			'2026-02-28',
			'2026-03-31',
			'2026-04-30',
			'2026-05-31',
		]);

		const leap = ScheduledTransactionMother.create({ startDate: '2024-01-31' });
		expect(leap.projectOccurrences('2024-01-31', '2024-04-30').map(occurrence => occurrence.dueDate)).toEqual([
			'2024-01-31',
			'2024-02-29',
			'2024-03-31',
			'2024-04-30',
		]);
	});

	it('computes daily, weekly, monthly and yearly intervals', () => {
		const daily = ScheduledTransactionMother.create({
			frequency: 'daily',
			interval: 3,
			startDate: '2026-05-01',
		});
		const weekly = ScheduledTransactionMother.create({
			frequency: 'weekly',
			interval: 2,
			startDate: '2026-05-01',
		});
		const monthly = ScheduledTransactionMother.create({
			frequency: 'monthly',
			interval: 3,
			startDate: '2026-05-01',
		});
		const yearly = ScheduledTransactionMother.create({
			frequency: 'yearly',
			interval: 2,
			startDate: '2026-05-01',
		});

		expect(daily.projectOccurrences('2026-05-01', '2026-05-10').map(item => item.dueDate)).toEqual([
			'2026-05-01',
			'2026-05-04',
			'2026-05-07',
			'2026-05-10',
		]);
		expect(weekly.projectOccurrences('2026-05-01', '2026-05-31').map(item => item.dueDate)).toEqual([
			'2026-05-01',
			'2026-05-15',
			'2026-05-29',
		]);
		expect(monthly.projectOccurrences('2026-05-01', '2026-11-30').map(item => item.dueDate)).toEqual([
			'2026-05-01',
			'2026-08-01',
			'2026-11-01',
		]);
		expect(yearly.projectOccurrences('2026-05-01', '2030-05-01').map(item => item.dueDate)).toEqual([
			'2026-05-01',
			'2028-05-01',
			'2030-05-01',
		]);
	});

	it('stops at the end date', () => {
		const schedule = ScheduledTransactionMother.create({
			endDate: '2026-07-31',
			startDate: '2026-05-01',
		});

		expect(schedule.projectOccurrences('2026-05-01', '2026-12-31').map(item => item.dueDate)).toEqual([
			'2026-05-01',
			'2026-06-01',
			'2026-07-01',
		]);
	});

	it('advances recurring schedules and completes after the last occurrence', () => {
		const schedule = ScheduledTransactionMother.create({
			endDate: '2026-07-01',
			startDate: '2026-05-01',
		});
		const second = schedule.advance();
		const third = second.advance();
		const completed = third.advance();

		expect(second).toMatchObject({ nextDueDate: '2026-06-01', occurrenceNumber: 1, status: 'active' });
		expect(third).toMatchObject({ nextDueDate: '2026-07-01', occurrenceNumber: 2, status: 'active' });
		expect(completed).toMatchObject({ nextDueDate: null, occurrenceNumber: 3, status: 'completed' });
	});

	it('advances one-time schedules to completion', () => {
		const schedule = ScheduledTransactionMother.create({ frequency: 'once', startDate: '2026-05-01' });

		expect(schedule.advance()).toMatchObject({
			nextDueDate: null,
			occurrenceNumber: 1,
			status: 'completed',
		});
	});

	it('pauses and resumes without catching up missed occurrences', () => {
		const paused = ScheduledTransactionMother.create({ startDate: '2026-01-31' }).advance().pause();

		expect(paused.status).toBe('paused');
		expect(paused.nextDueDate).toBe('2026-02-28');
		expect(paused.resume('2026-03-15')).toMatchObject({
			nextDueDate: '2026-03-31',
			occurrenceNumber: 2,
			status: 'active',
		});
	});

	it('keeps the next occurrence when resuming before or on it', () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-05-01' }).pause();

		expect(schedule.resume('2026-04-01')).toMatchObject({
			nextDueDate: '2026-05-01',
			status: 'active',
		});
		expect(schedule.resume('2026-05-01')).toMatchObject({
			nextDueDate: '2026-05-01',
			status: 'active',
		});
	});

	it('completes when resuming after the end date', () => {
		const paused = ScheduledTransactionMother.create({
			endDate: '2026-03-31',
			startDate: '2026-01-31',
		})
			.advance()
			.advance()
			.pause();

		expect(paused.resume('2026-04-01')).toMatchObject({
			nextDueDate: null,
			status: 'completed',
		});
	});

	it('rejects invalid status transitions', () => {
		const active = ScheduledTransactionMother.create({ startDate: '2026-05-01' });
		const completed = ScheduledTransactionMother.create({
			frequency: 'once',
			startDate: '2026-05-01',
		}).advance();

		expect(() => active.resume('2026-05-01')).toThrow(ScheduledTransactionTransitionError);
		expect(() => completed.pause()).toThrow(ScheduledTransactionTransitionError);
	});

	it('recalculates the next occurrence when recurrence changes', () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-01-31' });
		const updated = schedule.update({ frequency: 'monthly', startDate: '2026-02-15' }, '2026-06-20');

		expect(updated).toMatchObject({
			nextDueDate: '2026-07-15',
			occurrenceNumber: 5,
			status: 'active',
		});
	});

	it('preserves the next occurrence for non-recurrence edits', () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-01-31' });
		const updated = schedule.update({ amountMinor: 999, description: 'Updated' }, '2026-06-20');

		expect(updated).toMatchObject({
			amountMinor: 999,
			description: 'Updated',
			nextDueDate: '2026-01-31',
			occurrenceNumber: 0,
		});
	});

	it('completes when the end date excludes the next occurrence', () => {
		const schedule = ScheduledTransactionMother.restore({
			endDate: null,
			nextDueDate: '2026-03-31',
			occurrenceNumber: 2,
			startDate: '2026-01-31',
		});
		const updated = schedule.update({ endDate: '2026-03-01' }, '2026-02-01');

		expect(updated).toMatchObject({ nextDueDate: null, status: 'completed' });
	});

	it('rejects changes to completed schedules', () => {
		const completed = ScheduledTransactionMother.create({
			frequency: 'once',
			startDate: '2026-05-01',
		}).advance();

		expect(() => completed.update({ amountMinor: 100 }, '2026-05-01')).toThrow(ScheduledTransactionCompletedError);
	});

	it('knows when it is due', () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-05-01' });
		const paused = schedule.pause();

		expect(schedule.isDue('2026-04-30')).toBe(false);
		expect(schedule.isDue('2026-05-01')).toBe(true);
		expect(paused.isDue('2026-05-01')).toBe(false);
		expect(() => schedule.assertDue('2026-04-30')).toThrow(ScheduledTransactionNotDueError);
		expect(() => schedule.assertDue('2026-05-01')).not.toThrow();
	});

	it('creates the entry transaction from the next due occurrence', () => {
		const schedule = ScheduledTransactionMother.create({
			categoryId: 'category-1',
			startDate: '2026-05-01',
		});

		const entry = schedule.createEntry('user-1', '2026-05-01T10:00:00.000Z', 'transaction-1');

		expect(entry).toMatchObject({
			actorId: 'user-1',
			amountMinor: 1250,
			categoryId: 'category-1',
			createdAt: '2026-05-01T10:00:00.000Z',
			currencyCode: 'EUR',
			description: 'Rent',
			id: 'transaction-1',
			kind: 'expense',
			transactionDate: '2026-05-01',
		});
	});

	it('refuses to create an entry without a next due occurrence', () => {
		const completed = ScheduledTransactionMother.create({
			frequency: 'once',
			startDate: '2026-05-01',
		}).advance();

		expect(() => completed.createEntry('user-1', '2026-05-01T10:00:00.000Z', 'transaction-1')).toThrow(
			ScheduledTransactionNotDueError
		);
	});

	it('projects occurrences from a date range without replaying past ones', () => {
		const schedule = ScheduledTransactionMother.restore({
			nextDueDate: '2026-03-31',
			occurrenceNumber: 2,
			startDate: '2026-01-31',
		});

		expect(schedule.projectOccurrences('2026-02-01', '2026-05-31').map(item => item.dueDate)).toEqual([
			'2026-03-31',
			'2026-04-30',
			'2026-05-31',
		]);
		expect(schedule.projectOccurrences('2026-02-01', '2026-05-31', 2).map(item => item.dueDate)).toEqual([
			'2026-03-31',
			'2026-04-30',
		]);
	});

	it('rejects invalid projection ranges and limits', () => {
		const schedule = ScheduledTransactionMother.create({ startDate: '2026-05-01' });

		expect(() => schedule.projectOccurrences('2026-06-01', '2026-05-01')).toThrow(
			ScheduledTransactionProjectionRangeInvalidError
		);
		expect(() => schedule.projectOccurrences('2026-05-01', '2026-06-01', 0)).toThrow(
			ScheduledTransactionProjectionLimitInvalidError
		);
	});

	it('rejects inconsistent restored state', () => {
		expect(() => ScheduledTransactionMother.restore({ nextDueDate: '2026-05-02' })).toThrow(
			ScheduledTransactionStateInvalidError
		);
		expect(() => ScheduledTransactionMother.restore({ nextDueDate: '2026-05-01', status: 'completed' })).toThrow(
			ScheduledTransactionStateInvalidError
		);
	});
});
