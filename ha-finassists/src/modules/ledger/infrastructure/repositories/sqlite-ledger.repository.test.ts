import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { TransactionMother } from '@modules/ledger/domain/transaction.mother';
import { DatabaseMigrator } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { SqliteCategoryRepository } from './sqlite-category.repository';
import { SqliteLedgerRepository } from './sqlite-ledger.repository';

describe('SqliteLedgerRepository', () => {
	let database: Database;
	let repository: SqliteLedgerRepository;

	beforeEach(() => {
		database = new Database(':memory:');
		DatabaseMigrator.migrate(database);
		repository = new SqliteLedgerRepository(database);
	});

	afterEach(() => database.close());

	it('round-trips a transaction', async () => {
		const transaction = TransactionMother.create();
		await repository.save(transaction);

		const page = await repository.search();

		expect(page.total).toBe(1);
		expect(page.items[0]).toEqual(transaction);
	});

	it('orders by date, then creation time, newest first', async () => {
		const oldest = TransactionMother.create({ id: 'a', transactionDate: '2026-05-01' });
		const sameDayEarly = TransactionMother.create({ createdAt: '2026-05-15T08:00:00.000Z', id: 'b' });
		const sameDayLate = TransactionMother.create({ createdAt: '2026-05-15T09:00:00.000Z', id: 'c' });
		await repository.save(oldest);
		await repository.save(sameDayEarly);
		await repository.save(sameDayLate);

		const { items } = await repository.search();

		expect(items.map(item => item.id)).toEqual(['c', 'b', 'a']);
	});

	it('filters by kind and inclusive date range', async () => {
		await repository.save(TransactionMother.create({ id: 'a', kind: 'expense', transactionDate: '2026-04-30' }));
		await repository.save(TransactionMother.create({ id: 'b', kind: 'expense', transactionDate: '2026-05-01' }));
		await repository.save(TransactionMother.create({ id: 'c', kind: 'income', transactionDate: '2026-05-31' }));
		await repository.save(TransactionMother.create({ id: 'd', kind: 'expense', transactionDate: '2026-06-01' }));

		const range = await repository.search({ fromDate: '2026-05-01', toDate: '2026-05-31' });
		const expenses = await repository.search({ kind: 'expense' });

		expect(range.items.map(item => item.id)).toEqual(['c', 'b']);
		expect(expenses.total).toBe(3);
	});

	it('searches descriptions case-insensitively without treating wildcards as patterns', async () => {
		await repository.save(TransactionMother.create({ description: 'Supermercado Mercadona', id: 'a' }));
		await repository.save(TransactionMother.create({ description: 'Café con amigos', id: 'b' }));
		await repository.save(TransactionMother.create({ description: '100% pan', id: 'c' }));

		const groceries = await repository.search({ search: 'MERCADONA' });
		const wildcard = await repository.search({ search: '%' });

		expect(groceries.items.map(item => item.id)).toEqual(['a']);
		expect(wildcard.items.map(item => item.id)).toEqual(['c']);
	});

	it('filters by category', async () => {
		const categoryRepository = new SqliteCategoryRepository(database);
		await categoryRepository.save(CategoryMother.create({ id: 'category-1', name: 'Food' }));
		await categoryRepository.save(CategoryMother.create({ id: 'category-2', name: 'Travel' }));
		await repository.save(TransactionMother.create({ categoryId: 'category-1', id: 'a' }));
		await repository.save(TransactionMother.create({ categoryId: 'category-2', id: 'b' }));
		await repository.save(TransactionMother.create({ categoryId: null, id: 'c' }));

		const filtered = await repository.search({ categoryId: 'category-1' });

		expect(filtered.items.map(item => item.id)).toEqual(['a']);
		expect(filtered.total).toBe(1);
	});

	it('paginates while reporting the total', async () => {
		await Promise.all(
			['01', '02', '03'].map(async day =>
				repository.save(TransactionMother.create({ id: day, transactionDate: `2026-05-${day}` }))
			)
		);

		const page = await repository.search({ limit: 1, offset: 1 });

		expect(page.total).toBe(3);
		expect(page.items.map(item => item.id)).toEqual(['02']);
	});

	it('deletes an existing transaction and reports a missing one', async () => {
		await repository.save(TransactionMother.create({ id: 'a' }));

		const isFirstDeletion = await repository.delete({ id: 'a' });
		const isSecondDeletion = await repository.delete({ id: 'a' });
		const page = await repository.search();

		expect(isFirstDeletion).toBe(true);
		expect(isSecondDeletion).toBe(false);
		expect(page.total).toBe(0);
	});

	it('deletes several transactions and reports the count', async () => {
		await Promise.all(['a', 'b', 'c'].map(async id => repository.save(TransactionMother.create({ id }))));

		const deleted = await repository.deleteMany(['a', 'c']);
		const page = await repository.search();

		expect(deleted).toBe(2);
		expect(page.items.map(item => item.id)).toEqual(['b']);
	});

	it('finds and updates an existing transaction', async () => {
		const transaction = TransactionMother.create({ id: 'a' });
		await repository.save(transaction);

		const found = await repository.findById('a');
		const updated = TransactionMother.create({
			amountMinor: 999,
			description: 'Dinner',
			id: 'a',
			kind: 'income',
			transactionDate: '2026-05-20',
		});
		const isUpdated = await repository.update(updated);
		const afterUpdate = await repository.findById('a');
		const isMissing = await repository.update(TransactionMother.create({ id: 'missing' }));

		expect(found).toEqual(transaction);
		expect(isUpdated).toBe(true);
		expect(afterUpdate).toEqual(updated);
		expect(isMissing).toBe(false);
	});

	it('rejects a non-positive amount at the database level', () => {
		expect(() =>
			database
				.query(
					`INSERT INTO transactions (id, kind, amount_minor, currency_code, description, transaction_date, actor_id, created_at)
					 VALUES ('x', 'expense', 0, 'EUR', '', '2026-05-15', NULL, '2026-05-15T00:00:00.000Z')`
				)
				.run()
		).toThrow();
	});
});
