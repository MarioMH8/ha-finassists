import { describe, expect, test } from 'bun:test';

import { validateTransactionForm } from './transaction-validation';

const validValues = {
	amount: '12,50',
	categoryId: '',
	date: '2024-03-05',
	description: '  Lunch  ',
	kind: 'expense',
} as const;

describe('validateTransactionForm', () => {
	test('builds an API payload with minor units and a trimmed description', () => {
		expect(validateTransactionForm(validValues, 'EUR')).toEqual({
			transaction: {
				amountMinor: 1250,

				categoryId: null,
				description: 'Lunch',
				kind: 'expense',
				transactionDate: '2024-03-05',
			},
		});
	});

	test('allows an empty description', () => {
		const result = validateTransactionForm({ ...validValues, description: '', kind: 'income' }, 'EUR');

		expect(result.transaction).toEqual({
			amountMinor: 1250,
			categoryId: null,
			description: '',
			kind: 'income',
			transactionDate: '2024-03-05',
		});
	});

	test('reports every invalid field', () => {
		const result = validateTransactionForm(
			{ amount: '0', categoryId: '', date: '', description: 'x'.repeat(201), kind: 'expense' },
			'EUR'
		);

		expect(result.errors).toEqual({ amount: 'notPositive', date: 'required', description: 'tooLong' });
	});

	test('keeps the selected category', () => {
		expect(validateTransactionForm({ ...validValues, categoryId: 'category-1' }, 'EUR')).toMatchObject({
			transaction: { categoryId: 'category-1' },
		});
	});

	test('uses the currency precision', () => {
		expect(validateTransactionForm({ ...validValues, amount: '1.5' }, 'JPY').errors).toEqual({
			amount: 'precision',
		});
	});
});
