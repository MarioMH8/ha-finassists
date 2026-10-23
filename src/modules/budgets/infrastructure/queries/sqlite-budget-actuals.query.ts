import type { Database, SQLQueryBindings } from 'bun:sqlite';

import type { Budget, BudgetActualsQuery } from '../../domain';

interface ActualRow {
	amount_minor: string;
}

class SqliteBudgetActualsQuery implements BudgetActualsQuery {
	constructor(private readonly database: Database) {}

	actualMinor(budget: Budget): bigint {
		const rows = this.database
			.query<ActualRow, SQLQueryBindings[]>(
				`WITH RECURSIVE category_scope(id) AS (
					SELECT id FROM categories WHERE book_id = ? AND id = ?
					UNION
					SELECT child.id FROM categories child
					JOIN category_scope parent ON child.book_id = ? AND child.parent_id = parent.id
				), class_scope(id) AS (
					SELECT id FROM classes WHERE book_id = ? AND id = ?
					UNION
					SELECT child.id FROM classes child
					JOIN class_scope parent ON child.book_id = ? AND child.parent_id = parent.id
				)
				SELECT CAST(COALESCE(part.amount_minor, tx.amount_minor) AS TEXT) AS amount_minor
				FROM transactions tx
				LEFT JOIN transaction_parts part
					ON part.book_id = tx.book_id AND part.transaction_id = tx.id
				WHERE tx.book_id = ? AND tx.account_id = ?
					AND tx.transfer_id IS NULL
					AND tx.transaction_date >= ? AND tx.transaction_date <= ?
					AND tx.status IN ('cleared', 'reconciled')
					AND (? IS NULL OR part.category_id IN (SELECT id FROM category_scope))
					AND (? IS NULL OR part.class_id IN (SELECT id FROM class_scope))
				ORDER BY tx.transaction_date, tx.id, part.position, part.id`
			)
			.all(
				budget.bookId,
				budget.categoryId,
				budget.bookId,
				budget.bookId,
				budget.classId,
				budget.bookId,
				budget.bookId,
				budget.accountId,
				budget.periodStart,
				budget.periodEnd,
				budget.categoryId,
				budget.classId
			);

		return rows.reduce((total, row) => {
			const amountMinor = BigInt(row.amount_minor);

			return amountMinor < 0n ? total - amountMinor : total;
		}, 0n);
	}
}

export { SqliteBudgetActualsQuery };
