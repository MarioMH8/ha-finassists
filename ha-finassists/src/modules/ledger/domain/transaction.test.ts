import { describe, expect, it } from 'bun:test';

import {
	TransactionAmountInvalidError,
	TransactionDateCalendarInvalidError,
	TransactionDateFormatInvalidError,
	TransactionDescriptionTooLongError,
	TransactionKindInvalidError,
} from './transaction.error';
import { TransactionMother } from './transaction.mother';

describe('Transaction', () => {
	it('creates an expense and an income', () => {
		expect(TransactionMother.create({ kind: 'expense' }).kind).toBe('expense');
		expect(TransactionMother.create({ kind: 'income' }).kind).toBe('income');
	});

	it('trims the description', () => {
		expect(TransactionMother.create({ description: '  Coffee  ' }).description).toBe('Coffee');
	});

	it('accepts an empty description', () => {
		expect(TransactionMother.create({ description: '' }).description).toBe('');
	});

	it('rejects an unknown kind', () => {
		expect(() => TransactionMother.create({ kind: 'transfer' as never })).toThrow(TransactionKindInvalidError);
	});

	it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects amount %p', amountMinor => {
		expect(() => TransactionMother.create({ amountMinor })).toThrow(TransactionAmountInvalidError);
	});

	it('rejects a malformed date', () => {
		expect(() => TransactionMother.create({ transactionDate: '15/05/2026' })).toThrow(
			TransactionDateFormatInvalidError
		);
	});

	it('rejects a date that is not in the calendar', () => {
		expect(() => TransactionMother.create({ transactionDate: '2026-02-30' })).toThrow(
			TransactionDateCalendarInvalidError
		);
	});

	it('rejects a description longer than 200 characters', () => {
		expect(() => TransactionMother.create({ description: 'a'.repeat(201) })).toThrow(
			TransactionDescriptionTooLongError
		);
	});
});
