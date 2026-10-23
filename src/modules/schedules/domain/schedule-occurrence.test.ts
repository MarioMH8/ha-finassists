import { describe, expect, it } from 'bun:test';

import { ScheduledPaymentMother } from './schedule.mother';
import { ScheduleOccurrence } from './schedule-occurrence';
import {
	ScheduleOccurrenceRecordInvalidError,
	ScheduleOccurrenceTransitionInvalidError,
	ScheduleOccurrenceUnavailableError,
} from './schedule-occurrence.error';
import { ScheduleOccurrenceMother } from './schedule-occurrence.mother';

describe('ScheduleOccurrence', () => {
	it('creates a pending domain entity from a scheduled payment', () => {
		const occurrence = ScheduleOccurrenceMother.create();

		expect(occurrence).toBeInstanceOf(ScheduleOccurrence);
		expect(occurrence.status).toBe('pending');
		expect(occurrence.occurrenceNumber).toBe(0);
		expect(occurrence.dueDate).toBe('2025-01-31');
	});

	it('records a matching ledger transaction as an immutable state transition', () => {
		const occurrence = ScheduleOccurrenceMother.create();
		const recorded = occurrence.record(
			{ accountId: 'account-1', amountMinor: -1250, bookId: 'book-1', id: 'transaction-1' },
			'2025-01-31T12:00:00.000Z'
		);

		expect(occurrence.status).toBe('pending');
		expect(recorded.status).toBe('recorded');
		expect(recorded.transactionId).toBe('transaction-1');
		expect(recorded.recordedAt).toBe('2025-01-31T12:00:00.000Z');
	});

	it('returns the same occurrence when recording is retried with the same transaction', () => {
		const occurrence = ScheduleOccurrenceMother.create().record(
			{ accountId: 'account-1', amountMinor: -1250, bookId: 'book-1', id: 'transaction-1' },
			'2025-01-31T12:00:00.000Z'
		);

		const retry = occurrence.record(
			{ accountId: 'account-1', amountMinor: -1250, bookId: 'book-1', id: 'transaction-1' },
			'2025-01-31T12:00:00.000Z'
		);

		expect(retry).toBe(occurrence);
	});

	it('rejects recording a transaction with a different account or amount', () => {
		const occurrence = ScheduleOccurrenceMother.create();

		expect(() =>
			occurrence.record(
				{ accountId: 'account-2', amountMinor: -1250, bookId: 'book-1', id: 'transaction-1' },
				'2025-01-31T12:00:00.000Z'
			)
		).toThrow(ScheduleOccurrenceRecordInvalidError);
	});

	it('skips a pending occurrence without mutating the original', () => {
		const occurrence = ScheduleOccurrenceMother.create();
		const skipped = occurrence.skip();

		expect(occurrence.status).toBe('pending');
		expect(skipped.status).toBe('skipped');
	});

	it('does not allow a skipped occurrence to be recorded', () => {
		const skipped = ScheduleOccurrenceMother.create().skip();

		expect(() =>
			skipped.record(
				{ accountId: 'account-1', amountMinor: -1250, bookId: 'book-1', id: 'transaction-1' },
				'2025-01-31T12:00:00.000Z'
			)
		).toThrow(ScheduleOccurrenceRecordInvalidError);
	});

	it('does not allow a recorded occurrence to be skipped', () => {
		const recorded = ScheduleOccurrenceMother.create().record(
			{ accountId: 'account-1', amountMinor: -1250, bookId: 'book-1', id: 'transaction-1' },
			'2025-01-31T12:00:00.000Z'
		);

		expect(() => recorded.skip()).toThrow(ScheduleOccurrenceTransitionInvalidError);
	});

	it('rejects an occurrence number outside the schedule range', () => {
		const schedule = ScheduledPaymentMother.create({ frequency: 'one_time' });

		expect(() => ScheduleOccurrence.create(schedule, 1, 'occurrence-2')).toThrow(
			ScheduleOccurrenceUnavailableError
		);
	});
});
