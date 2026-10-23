import { describe, expect, it } from 'bun:test';

import type { ScheduledPayment } from './schedule';
import { createScheduledPayment, dueDateAtOccurrence, nextDueDate, transitionScheduleStatus } from './schedule';

function makeSchedule(overrides: Partial<Parameters<typeof createScheduledPayment>[0]> = {}): ScheduledPayment {
	return createScheduledPayment({
		accountId: 'account-1',
		amountMinor: -1250,
		bookId: 'book-1',
		frequency: 'monthly',
		id: 'schedule-1',
		startDate: '2025-01-31',
		...overrides,
	});
}

describe('schedule recurrence', () => {
	it('anchors monthly recurrences to the original month-end day', () => {
		const schedule = makeSchedule();
		expect(nextDueDate(schedule, '2025-01-31', 1)).toBe('2025-02-28');
		expect(nextDueDate(schedule, '2025-02-28', 2)).toBe('2025-03-31');
	});

	it('uses UTC calendar stepping for daily and weekly frequencies', () => {
		expect(nextDueDate(makeSchedule({ frequency: 'daily', startDate: '2024-02-28' }), undefined, 1)).toBe(
			'2024-02-29'
		);
		expect(nextDueDate(makeSchedule({ frequency: 'weekly', startDate: '2025-01-01' }), undefined, 2)).toBe(
			'2025-01-15'
		);
	});

	it('anchors quarterly and yearly recurrences to the original day, including leap dates', () => {
		const quarterly = makeSchedule({ frequency: 'quarterly' });
		expect(dueDateAtOccurrence(quarterly, 1)).toBe('2025-04-30');
		expect(dueDateAtOccurrence(quarterly, 2)).toBe('2025-07-31');

		const yearly = makeSchedule({ frequency: 'yearly', startDate: '2024-02-29' });
		expect(dueDateAtOccurrence(yearly, 1)).toBe('2025-02-28');
		expect(dueDateAtOccurrence(yearly, 4)).toBe('2028-02-29');
	});

	it('supports one-time schedules, finite installments, end dates, and after-date lookup', () => {
		const oneTime = makeSchedule({ frequency: 'one_time', startDate: '2025-03-04' });
		expect(dueDateAtOccurrence(oneTime, 0)).toBe('2025-03-04');
		expect(dueDateAtOccurrence(oneTime, 1)).toBeUndefined();

		const installments = makeSchedule({ occurrenceLimit: 3 });
		expect(dueDateAtOccurrence(installments, 2)).toBe('2025-03-31');
		expect(dueDateAtOccurrence(installments, 3)).toBeUndefined();
		expect(nextDueDate(makeSchedule(), '2025-02-28')).toBe('2025-03-31');

		const bounded = makeSchedule({ endDate: '2025-04-30' });
		expect(dueDateAtOccurrence(bounded, 1)).toBe('2025-02-28');
		expect(dueDateAtOccurrence(bounded, 4)).toBeUndefined();
	});

	it('rejects unsafe amounts and impossible dates', () => {
		expect(() => makeSchedule({ amountMinor: 1.5 })).toThrow('safe integer');
		expect(() => makeSchedule({ startDate: '2025-02-29' })).toThrow('valid YYYY-MM-DD');
	});

	it('permits pause/resume and cancellation but rejects terminal transitions', () => {
		const active = makeSchedule();
		const paused = transitionScheduleStatus(active, 'paused');
		expect(paused.status).toBe('paused');
		expect(transitionScheduleStatus(paused, 'active').status).toBe('active');
		expect(transitionScheduleStatus(active, 'canceled').status).toBe('canceled');
		expect(() => transitionScheduleStatus(transitionScheduleStatus(active, 'canceled'), 'active')).toThrow(
			'Cannot transition'
		);
	});
});
