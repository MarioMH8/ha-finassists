import { describe, expect, it } from 'bun:test';

import {
	CategoryKindInvalidError,
	CategoryKindMismatchError,
	CategoryNameInvalidError,
	CategoryNameTooLongError,
} from './category.error';
import { CategoryMother } from './category.mother';

describe('Category', () => {
	it('creates an expense and an income category', () => {
		expect(CategoryMother.create({ kind: 'expense' }).kind).toBe('expense');
		expect(CategoryMother.create({ kind: 'income' }).kind).toBe('income');
	});

	it('trims the name', () => {
		expect(CategoryMother.create({ name: '  Groceries  ' }).name).toBe('Groceries');
	});

	it('rejects an unknown kind', () => {
		expect(() => CategoryMother.create({ kind: 'transfer' as never })).toThrow(CategoryKindInvalidError);
	});

	it.each(['', ' '.repeat(3)])('rejects the name %p', name => {
		expect(() => CategoryMother.create({ name })).toThrow(CategoryNameInvalidError);
	});

	it('rejects a name longer than 40 characters', () => {
		expect(() => CategoryMother.create({ name: 'a'.repeat(41) })).toThrow(CategoryNameTooLongError);
	});

	it('accepts emoji in the name', () => {
		expect(CategoryMother.create({ name: '🍜 Comida' }).name).toBe('🍜 Comida');
	});

	it('accepts a transaction of its own kind', () => {
		expect(() => CategoryMother.create({ kind: 'expense' }).assertAccepts('expense')).not.toThrow();
	});

	it('rejects a transaction of another kind', () => {
		expect(() => CategoryMother.create({ kind: 'income' }).assertAccepts('expense')).toThrow(
			CategoryKindMismatchError
		);
	});
});
