import { CategoryMother } from '@modules/ledger/domain/category.mother';
import { TransactionMother } from '@modules/ledger/domain/transaction.mother';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { SqliteCategoryRepository } from './sqlite-category.repository';
import { SqliteLedgerRepository } from './sqlite-ledger.repository';

describe('SqliteCategoryRepository', () => {
	let database: Database;
	let repository: SqliteCategoryRepository;

	beforeEach(() => {
		database = new Database(':memory:');
		migrateDatabase(database);
		repository = new SqliteCategoryRepository(database);
	});

	afterEach(() => database.close());

	it('round-trips a category', async () => {
		const category = CategoryMother.create();
		await repository.save(category);

		expect(await repository.findById(category.id)).toEqual(category);
	});

	it('finds a category by name regardless of case', async () => {
		const category = CategoryMother.create({ name: 'Groceries' });
		await repository.save(category);

		expect(await repository.findByName('expense', 'groceries')).toEqual(category);
		expect(await repository.findByName('income', 'Groceries')).toBeUndefined();
	});

	it('rejects a duplicate name within the same kind', async () => {
		await repository.save(CategoryMother.create({ id: 'a', name: 'Food' }));

		let failure: unknown;
		try {
			await repository.save(CategoryMother.create({ id: 'b', name: 'food' }));
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain('UNIQUE');
	});

	it('lists categories with their number of movements', async () => {
		const ledger = new SqliteLedgerRepository(database);
		const category = CategoryMother.create({ id: 'category-1', name: 'Food' });
		await repository.save(category);
		await repository.save(CategoryMother.create({ id: 'category-2', kind: 'income', name: 'Salary' }));
		await ledger.save(TransactionMother.create({ categoryId: 'category-1', id: 'transaction-1' }));

		const summaries = await repository.search();

		expect(summaries.map(summary => [summary.category.id, summary.transactionCount])).toEqual([
			['category-2', 0],
			['category-1', 1],
		]);
	});

	it('filters by kind', async () => {
		await repository.save(CategoryMother.create({ id: 'category-1', kind: 'expense' }));
		await repository.save(CategoryMother.create({ id: 'category-2', kind: 'income' }));

		const expenses = await repository.search({ kind: 'expense' });

		expect(expenses.map(summary => summary.category.id)).toEqual(['category-1']);
	});

	it('updates and deletes a category', async () => {
		const category = CategoryMother.create();
		await repository.save(category);

		expect(await repository.update(CategoryMother.create({ name: 'Food' }))).toBe(true);
		const updated = await repository.findById(category.id);

		expect(updated?.name).toBe('Food');
		expect(await repository.delete(category.id)).toBe(true);
		expect(await repository.findById(category.id)).toBeUndefined();
	});

	it('refuses to delete a category referenced by a transaction', async () => {
		const ledger = new SqliteLedgerRepository(database);
		await repository.save(CategoryMother.create({ id: 'category-1' }));
		await ledger.save(TransactionMother.create({ categoryId: 'category-1' }));

		let failure: unknown;
		try {
			await repository.delete('category-1');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(Error);
		expect(await repository.countTransactions('category-1')).toBe(1);
	});
});
