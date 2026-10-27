import { TransactionAmountInvalidError, TransactionDateFormatInvalidError } from '@modules/ledger/domain';
import { describe, expect, it } from 'bun:test';

import type { TransactionRow } from './sqlite-transaction.mapper';
import { SqliteTransactionMapper } from './sqlite-transaction.mapper';

function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
	return {
		actor_id: 'user-1',
		amount_minor: 1250,
		category_id: 'category-1',
		created_at: '2026-05-15T10:00:00.000Z',
		currency_code: 'EUR',
		description: 'Groceries',
		id: 'transaction-1',
		kind: 'expense',
		transaction_date: '2026-05-15',
		...overrides,
	};
}

describe('SqliteTransactionMapper', () => {
	it('maps every column to the domain transaction', () => {
		const transaction = SqliteTransactionMapper.toDomain(row());

		expect(transaction).toMatchObject({
			actorId: 'user-1',
			amountMinor: 1250,
			categoryId: 'category-1',
			createdAt: '2026-05-15T10:00:00.000Z',
			currencyCode: 'EUR',
			description: 'Groceries',
			id: 'transaction-1',
			kind: 'expense',
			transactionDate: '2026-05-15',
		});
	});

	it('keeps null category and actor references', () => {
		const transaction = SqliteTransactionMapper.toDomain(row({ actor_id: null, category_id: null }));

		expect(transaction.actorId).toBeNull();
		expect(transaction.categoryId).toBeNull();
	});

	it('maps large amounts exactly', () => {
		const amountMinor = Number.MAX_SAFE_INTEGER;

		expect(SqliteTransactionMapper.toDomain(row({ amount_minor: amountMinor })).amountMinor).toBe(amountMinor);
	});

	it('leaves amount validation to the domain', () => {
		expect(() => SqliteTransactionMapper.toDomain(row({ amount_minor: 0 }))).toThrow(TransactionAmountInvalidError);
	});

	it('leaves date validation to the domain', () => {
		expect(() => SqliteTransactionMapper.toDomain(row({ transaction_date: '15/05/2026' }))).toThrow(
			TransactionDateFormatInvalidError
		);
	});
});
