import type { CategoryCriteria, CategoryKind, CategoryRepository, CategorySummary } from '@modules/ledger/domain';
import { Category } from '@modules/ledger/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

import type { CategoryRow } from './mappers/sqlite-category.mapper';
import { SqliteCategoryMapper } from './mappers/sqlite-category.mapper';

function where(criteria: CategoryCriteria): { parameters: SQLQueryBindings[]; sql: string } {
	return criteria.kind === undefined
		? { parameters: [], sql: '' }
		: { parameters: [criteria.kind], sql: ' WHERE categories.kind = ?' };
}

const SELECT_CATEGORY = `
	SELECT categories.id, categories.name, categories.kind, categories.created_at,
	       COUNT(transactions.id) AS transaction_count,
	       (SELECT COUNT(*) FROM scheduled_transactions
	        WHERE scheduled_transactions.category_id = categories.id) AS scheduled_transaction_count
	FROM categories
	LEFT JOIN transactions ON transactions.category_id = categories.id
`;

export class SqliteCategoryRepository implements CategoryRepository {
	constructor(private readonly database: Database) {}

	async countScheduledTransactions(id: string): Promise<number> {
		const row = this.database
			.query<{ total: number }, [string]>(
				'SELECT COUNT(*) AS total FROM scheduled_transactions WHERE category_id = ?'
			)
			.get(id);
		await Promise.resolve();

		return row?.total ?? 0;
	}

	async countTransactions(id: string): Promise<number> {
		const row = this.database
			.query<{ total: number }, [string]>('SELECT COUNT(*) AS total FROM transactions WHERE category_id = ?')
			.get(id);
		await Promise.resolve();

		return row?.total ?? 0;
	}

	async delete(id: string): Promise<boolean> {
		const result = this.database.query('DELETE FROM categories WHERE id = ?').run(id);
		await Promise.resolve();

		return result.changes > 0;
	}

	async findById(id: string): Promise<Category | undefined> {
		const row = this.database
			.query<CategoryRow, [string]>(`${SELECT_CATEGORY} WHERE categories.id = ? GROUP BY categories.id`)
			.get(id);
		await Promise.resolve();

		return row === null ? undefined : SqliteCategoryMapper.toDomain(row);
	}

	async findByName(kind: CategoryKind, name: string): Promise<Category | undefined> {
		const row = this.database
			.query<CategoryRow, [CategoryKind, string]>(
				`${SELECT_CATEGORY}
				 WHERE categories.kind = ? AND categories.name = ? COLLATE NOCASE
				 GROUP BY categories.id`
			)
			.get(kind, name);
		await Promise.resolve();

		return row === null ? undefined : SqliteCategoryMapper.toDomain(row);
	}

	async save(category: Category): Promise<void> {
		this.database
			.query('INSERT INTO categories (id, name, kind, created_at) VALUES (?, ?, ?, ?)')
			.run(category.id, category.name, category.kind, category.createdAt);
		await Promise.resolve();
	}

	async search(criteria: CategoryCriteria = {}): Promise<CategorySummary[]> {
		const { parameters, sql } = where(criteria);
		const rows = this.database
			.query<CategoryRow, SQLQueryBindings[]>(
				`${SELECT_CATEGORY}${sql} GROUP BY categories.id ORDER BY categories.kind DESC, categories.name COLLATE NOCASE ASC`
			)
			.all(...parameters);
		await Promise.resolve();

		return rows.map(row => SqliteCategoryMapper.toSummary(row));
	}

	async update(category: Category): Promise<boolean> {
		const result = this.database
			.query('UPDATE categories SET name = ?, kind = ? WHERE id = ?')
			.run(category.name, category.kind, category.id);
		await Promise.resolve();

		return result.changes > 0;
	}
}
