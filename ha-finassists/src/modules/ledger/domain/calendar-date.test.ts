import { describe, expect, it } from 'bun:test';

import { CalendarDate } from './calendar-date';

describe('calendar dates', () => {
	it.each([
		['2026-10-26', true],
		['2024-02-29', true],
		['2026-02-29', false],
		['2026-13-01', false],
		['2026-04-31', false],
		['2026-1-01', false],
		['0000-01-01', false],
	])('validates %s as %s', (value, expected) => {
		expect(CalendarDate.isValid(value)).toBe(expected);
	});

	it('parses calendar dates into their components', () => {
		expect(CalendarDate.parse('2026-10-26')).toEqual({ day: 26, month: 10, year: 2026 });
		expect(CalendarDate.parse('2026-02-30')).toBeUndefined();
	});

	it('adds days across months and years', () => {
		expect(CalendarDate.addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(CalendarDate.addDays('2024-02-28', 1)).toBe('2024-02-29');
		expect(CalendarDate.addDays('2026-02-28', 1)).toBe('2026-03-01');
		expect(CalendarDate.addDays('2026-10-26', -1)).toBe('2026-10-25');
		expect(CalendarDate.addDays('not-a-date', 1)).toBeUndefined();
	});

	it('adds months with anchored end-of-month clamping', () => {
		expect(CalendarDate.addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(CalendarDate.addMonths('2024-01-31', 1)).toBe('2024-02-29');
		expect(CalendarDate.addMonths('2026-01-31', 2)).toBe('2026-03-31');
		expect(CalendarDate.addMonths('2026-11-30', 3)).toBe('2027-02-28');
		expect(CalendarDate.addMonths('2026-01-31', -1)).toBe('2025-12-31');
		expect(CalendarDate.addMonths('2026-01-31', 12)).toBe('2027-01-31');
	});

	it('adds years with leap-day clamping', () => {
		expect(CalendarDate.addYears('2024-02-29', 1)).toBe('2025-02-28');
		expect(CalendarDate.addYears('2024-02-29', 4)).toBe('2028-02-29');
		expect(CalendarDate.addYears('2026-10-26', 2)).toBe('2028-10-26');
	});

	it('measures whole days between dates', () => {
		expect(CalendarDate.daysBetween('2026-10-26', '2026-10-26')).toBe(0);
		expect(CalendarDate.daysBetween('2026-10-26', '2026-11-02')).toBe(7);
		expect(CalendarDate.daysBetween('2024-02-28', '2024-03-01')).toBe(2);
	});

	it('resolves today in an explicit time zone', () => {
		const now = new Date('2026-01-01T00:30:00.000Z');

		expect(CalendarDate.todayInTimeZone('UTC', now)).toBe('2026-01-01');
		expect(CalendarDate.todayInTimeZone('America/New_York', now)).toBe('2025-12-31');
	});
});
