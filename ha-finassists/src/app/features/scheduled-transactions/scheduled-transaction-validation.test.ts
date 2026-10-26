import { describe, expect, it } from 'bun:test';

import { validateScheduledTransactionForm } from './scheduled-transaction-validation';

function values(overrides: Partial<Parameters<typeof validateScheduledTransactionForm>[0]> = {}) {
	return {
		amount: '12.50',
		categoryId: '',
		date: '2026-05-01',
		description: 'Rent',
		endDate: '',
		frequency: 'monthly' as const,
		interval: '2',
		kind: 'expense' as const,
		postingMode: 'automatic' as const,
		...overrides,
	};
}

describe('validateScheduledTransactionForm', () => {
	it('builds a monthly schedule with an interval and end date', () => {
		const validation = validateScheduledTransactionForm(
			values({ categoryId: 'category-1', endDate: '2026-12-31' }),
			'EUR'
		);

		expect(validation.errors).toBeUndefined();
		expect(validation.transaction).toEqual({
			amountMinor: 1250,
			categoryId: 'category-1',
			description: 'Rent',
			endDate: '2026-12-31',
			frequency: 'monthly',
			interval: 2,
			kind: 'expense',
			postingMode: 'automatic',
			startDate: '2026-05-01',
		});
	});

	it('normalizes a one-time schedule and clears an empty category', () => {
		const validation = validateScheduledTransactionForm(
			values({
				categoryId: '',
				endDate: '2026-12-31',
				frequency: 'once',
				interval: '0',
			}),
			'EUR'
		);

		expect(validation.transaction).toMatchObject({
			categoryId: null,
			endDate: null,
			frequency: 'once',
			interval: 1,
		});
	});

	it('reports invalid amounts, dates, intervals and end dates', () => {
		expect(validateScheduledTransactionForm(values({ amount: '0' }), 'EUR').errors).toMatchObject({
			amount: 'notPositive',
		});
		expect(validateScheduledTransactionForm(values({ date: '2026-02-30' }), 'EUR').errors).toMatchObject({
			date: 'required',
		});
		expect(validateScheduledTransactionForm(values({ interval: '0' }), 'EUR').errors).toMatchObject({
			interval: 'invalid',
		});
		expect(validateScheduledTransactionForm(values({ endDate: '2026-04-30' }), 'EUR').errors).toMatchObject({
			endDate: 'range',
		});
		expect(validateScheduledTransactionForm(values({ endDate: '2026-02-30' }), 'EUR').errors).toMatchObject({
			endDate: 'invalid',
		});
	});

	it('rejects descriptions over the limit', () => {
		const validation = validateScheduledTransactionForm(values({ description: 'x'.repeat(201) }), 'EUR');

		expect(validation.errors).toMatchObject({ description: 'tooLong' });
	});
});
