import { describe, expect, test } from 'bun:test';

import { currentMonthRange, isIsoDate, monthsRange, todayIsoDate } from './transaction-dates';

describe('transaction dates', () => {
	test('formats the local date as an ISO date', () => {
		expect(todayIsoDate(new Date(2024, 0, 5, 23, 59))).toBe('2024-01-05');
	});

	test('returns the first and last day of the current month', () => {
		expect(currentMonthRange(new Date(2024, 1, 15))).toEqual({ fromDate: '2024-02-01', toDate: '2024-02-29' });
		expect(currentMonthRange(new Date(2025, 11, 31))).toEqual({ fromDate: '2025-12-01', toDate: '2025-12-31' });
	});

	test('returns a range covering the requested number of months', () => {
		expect(monthsRange(6, new Date(2024, 1, 15))).toEqual({ fromDate: '2023-09-01', toDate: '2024-02-29' });
		expect(monthsRange(1, new Date(2024, 0, 10))).toEqual({ fromDate: '2024-01-01', toDate: '2024-01-31' });
	});

	test('validates ISO calendar dates', () => {
		expect(isIsoDate('2024-02-29')).toBe(true);
		expect(isIsoDate('2023-02-29')).toBe(false);
		expect(isIsoDate('2024-13-01')).toBe(false);
		expect(isIsoDate('')).toBe(false);
		expect(isIsoDate('05/03/2024')).toBe(false);
	});
});
