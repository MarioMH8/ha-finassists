import { CategoryNameInvalidError } from '@modules/ledger/domain';
import { describe, expect, it } from 'bun:test';

import type { CategoryRow } from './sqlite-category.mapper';
import { SqliteCategoryMapper } from './sqlite-category.mapper';

function row(overrides: Partial<CategoryRow> = {}): CategoryRow {
	return {
		created_at: '2026-05-15T10:00:00.000Z',
		id: 'category-1',
		kind: 'expense',
		name: 'Groceries',
		scheduled_transaction_count: 0,
		transaction_count: 0,
		...overrides,
	};
}

describe('SqliteCategoryMapper', () => {
	it('maps every column to the domain category', () => {
		const category = SqliteCategoryMapper.toDomain(row());

		expect(category).toMatchObject({
			createdAt: '2026-05-15T10:00:00.000Z',
			id: 'category-1',
			kind: 'expense',
			name: 'Groceries',
		});
	});

	it('maps transaction and scheduled transaction counts', () => {
		const summary = SqliteCategoryMapper.toSummary(
			row({ scheduled_transaction_count: 4321, transaction_count: 123_456 })
		);

		expect(summary).toMatchObject({
			scheduledTransactionCount: 4321,
			transactionCount: 123_456,
		});
		expect(summary.category.id).toBe('category-1');
	});

	it('keeps zero counts for a category without movements', () => {
		const summary = SqliteCategoryMapper.toSummary(row());

		expect(summary.scheduledTransactionCount).toBe(0);
		expect(summary.transactionCount).toBe(0);
	});

	it('leaves name validation to the domain', () => {
		expect(() => SqliteCategoryMapper.toDomain(row({ name: ' '.repeat(3) }))).toThrow(CategoryNameInvalidError);
	});
});
