import { describe, expect, it } from 'bun:test';

import type { CreateScheduledPaymentInput } from './schedule';
import { ScheduledPayment } from './schedule';
import { ScheduledPaymentMother } from './schedule.mother';

describe('schedule recurrence', () => {
	it('creates a ScheduledPayment domain entity', () => {
		expect(ScheduledPaymentMother.create().constructor.name).toBe('ScheduledPayment');
	});

	it('updates a schedule immutably through its entity behavior', () => {
		const schedule = ScheduledPaymentMother.create();
		const updated = schedule.update({ amountMinor: -1300 });

		expect(updated.amountMinor).toBe(-1300);
		expect(schedule.amountMinor).toBe(-1250);
	});

	it('calculates due dates through the schedule entity', () => {
		const schedule = ScheduledPaymentMother.create();
		const dueDate = schedule.dueDateAtOccurrence(1);

		expect(dueDate).toBe('2025-02-28');
	});

	it('finds the next due date after a calendar date through the entity', () => {
		const schedule = ScheduledPaymentMother.create();
		const dueDate = schedule.nextDueDate('2025-01-31');

		expect(dueDate).toBe('2025-02-28');
	});

	it('anchors monthly recurrences to the original month-end day', () => {
		const schedule = ScheduledPaymentMother.create();
		expect(schedule.nextDueDate('2025-01-31', 1)).toBe('2025-02-28');
		expect(schedule.nextDueDate('2025-02-28', 2)).toBe('2025-03-31');
	});

	it('uses UTC calendar stepping for daily and weekly frequencies', () => {
		expect(
			ScheduledPaymentMother.create({ frequency: 'daily', startDate: '2024-02-28' }).nextDueDate(undefined, 1)
		).toBe('2024-02-29');
		expect(
			ScheduledPaymentMother.create({ frequency: 'weekly', startDate: '2025-01-01' }).nextDueDate(undefined, 2)
		).toBe('2025-01-15');
	});

	it('anchors quarterly and yearly recurrences to the original day, including leap dates', () => {
		const quarterly = ScheduledPaymentMother.create({ frequency: 'quarterly' });
		expect(quarterly.dueDateAtOccurrence(1)).toBe('2025-04-30');
		expect(quarterly.dueDateAtOccurrence(2)).toBe('2025-07-31');

		const yearly = ScheduledPaymentMother.create({ frequency: 'yearly', startDate: '2024-02-29' });
		expect(yearly.dueDateAtOccurrence(1)).toBe('2025-02-28');
		expect(yearly.dueDateAtOccurrence(4)).toBe('2028-02-29');
	});

	it('supports one-time schedules, finite installments, end dates, and after-date lookup', () => {
		const oneTime = ScheduledPaymentMother.create({ frequency: 'one_time', startDate: '2025-03-04' });
		expect(oneTime.dueDateAtOccurrence(0)).toBe('2025-03-04');
		expect(oneTime.dueDateAtOccurrence(1)).toBeUndefined();

		const installments = ScheduledPaymentMother.create({ occurrenceLimit: 3 });
		expect(installments.dueDateAtOccurrence(2)).toBe('2025-03-31');
		expect(installments.dueDateAtOccurrence(3)).toBeUndefined();
		expect(ScheduledPaymentMother.create().nextDueDate('2025-02-28')).toBe('2025-03-31');

		const bounded = ScheduledPaymentMother.create({ endDate: '2025-04-30' });
		expect(bounded.dueDateAtOccurrence(1)).toBe('2025-02-28');
		expect(bounded.dueDateAtOccurrence(4)).toBeUndefined();
	});

	it('throws a semantic error for an unsupported persisted status', () => {
		const properties = {
			accountId: 'account-1',
			amountMinor: -1250,
			bookId: 'book-1',
			createdAt: '2025-01-01T00:00:00.000Z',
			frequency: 'monthly',
			id: 'schedule-1',
			interval: 1,
			memo: '',
			payee: '',
			startDate: '2025-01-31',
			status: 'archived',
		} as unknown as Parameters<typeof ScheduledPayment.restore>[0];
		let error: unknown;
		try {
			ScheduledPayment.restore(properties);
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleStatusInvalidError' });
	});

	it('throws a semantic error for an unsupported frequency', () => {
		const input = {
			accountId: 'account-1',
			amountMinor: -1250,
			bookId: 'book-1',
			frequency: 'unsupported',
			id: 'schedule-1',
			startDate: '2025-01-31',
		} as unknown as CreateScheduledPaymentInput;
		let error: unknown;
		try {
			ScheduledPayment.create(input);
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleFrequencyInvalidError' });
	});

	it('throws a semantic error for a missing schedule identity', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ id: ' ' });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleIdentityInvalidError' });
	});

	it('throws a semantic error for an invalid after date', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create().nextDueDate('2025-02-29');
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleAfterDateInvalidError' });
	});

	it('throws a semantic error for a negative occurrence number', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create().dueDateAtOccurrence(-1);
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleOccurrenceNumberInvalidError' });
	});

	it('throws a semantic error when schedule text exceeds its limit', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ memo: 'm'.repeat(501) });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleTextInvalidError' });
	});

	it('throws a semantic error for an invalid occurrence limit', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ occurrenceLimit: 0 });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleOccurrenceLimitInvalidError' });
	});

	it('throws a semantic error for a one-time schedule interval other than one', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ frequency: 'one_time', interval: 2 });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleOneTimeIntervalInvalidError' });
	});

	it('throws a semantic error for an invalid recurrence interval', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ interval: 0 });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleIntervalInvalidError' });
	});

	it('throws a semantic error for an unsafe amount', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ amountMinor: 1.5 });
		} catch (error_) {
			error = error_;
		}

		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({ name: 'ScheduleAmountInvalidError' });
	});

	it('throws a semantic error when the end date precedes the start date', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ endDate: '2025-01-30' });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleDateRangeInvalidError' });
	});

	it('throws a semantic error for an impossible end date', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ endDate: '2025-02-29' });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleEndDateInvalidError' });
	});

	it('throws a semantic error for an impossible start date', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create({ startDate: '2025-02-29' });
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleStartDateInvalidError' });
	});

	it('rejects unsafe amounts and impossible dates', () => {
		expect(() => ScheduledPaymentMother.create({ amountMinor: 1.5 })).toThrow('safe integer');
		expect(() => ScheduledPaymentMother.create({ startDate: '2025-02-29' })).toThrow('valid YYYY-MM-DD');
	});

	it('changes status through immutable entity behavior', () => {
		const schedule = ScheduledPaymentMother.create();
		const paused = schedule.transitionTo('paused');

		expect(paused.status).toBe('paused');
		expect(schedule.status).toBe('active');
	});

	it('throws a semantic error when a terminal schedule cannot transition', () => {
		let error: unknown;
		try {
			ScheduledPaymentMother.create().transitionTo('canceled').transitionTo('active');
		} catch (error_) {
			error = error_;
		}

		expect(error).toMatchObject({ name: 'ScheduleTransitionInvalidError' });
	});

	it('permits pause/resume and cancellation but rejects terminal transitions', () => {
		const active = ScheduledPaymentMother.create();
		const paused = active.transitionTo('paused');
		expect(paused.status).toBe('paused');
		expect(paused.transitionTo('active').status).toBe('active');
		expect(active.transitionTo('canceled').status).toBe('canceled');
		expect(() => active.transitionTo('canceled').transitionTo('active')).toThrow('Cannot transition');
	});
});
