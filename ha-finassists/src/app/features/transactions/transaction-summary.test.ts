import { describe, expect, test } from 'bun:test';

import { buildTransactionSummary, SUMMARY_MONTHS } from './transaction-summary';

function transaction(overrides: Partial<Parameters<typeof buildTransactionSummary>[0][number]> = {}) {
	return {
		amountMinor: 1000,
		currencyCode: 'EUR',
		kind: 'expense' as const,
		transactionDate: '2026-10-05',
		...overrides,
	};
}

describe('buildTransactionSummary', () => {
	test('groups transactions by month and compares against the previous month', () => {
		const summary = buildTransactionSummary(
			[
				transaction({ amountMinor: 5000, kind: 'income', transactionDate: '2026-10-01' }),
				transaction({ amountMinor: 2000, transactionDate: '2026-10-04' }),
				transaction({ amountMinor: 4000, kind: 'income', transactionDate: '2026-09-01' }),
				transaction({ amountMinor: 1000, transactionDate: '2026-09-04' }),
				transaction({ amountMinor: 9999, currencyCode: 'USD', transactionDate: '2026-10-05' }),
			],
			'EUR',
			'en',
			new Date(2026, 9, 15)
		);

		expect(summary.months).toHaveLength(SUMMARY_MONTHS);
		expect(summary.months.map(month => month.key)).toEqual([
			'2026-05',
			'2026-06',
			'2026-07',
			'2026-08',
			'2026-09',
			'2026-10',
		]);
		expect(summary).toMatchObject({
			expenseMinor: 2000,
			incomeMinor: 5000,
			netMinor: 3000,
			previous: { expenseMinor: 1000, incomeMinor: 4000, netMinor: 3000 },
		});
	});

	test('keeps empty months in the series', () => {
		const summary = buildTransactionSummary([], 'EUR', 'en', new Date(2026, 9, 15));

		expect(summary.months).toHaveLength(SUMMARY_MONTHS);
		expect(summary.months.every(month => month.incomeMinor === 0 && month.expenseMinor === 0)).toBe(true);
	});
});
