import type { Database } from 'bun:sqlite';

import type { BudgetRepository } from '../../domain';
import { Budget, BudgetAmountOutOfRangeError, BudgetPeriodOverlapError } from '../../domain';

interface BudgetRow {
	account_id: string;
	book_id: string;
	category_id: null | string;
	class_id: null | string;
	currency_code: string;
	id: string;
	name: string;
	period_end: string;
	period_start: string;
	planned_minor: number;
}

interface ActualRow {
	amount_minor: string;
}

function toBudget(row: BudgetRow): Budget {
	return Budget.restore({
		accountId: row.account_id,
		bookId: row.book_id,
		categoryId: row.category_id,
		classId: row.class_id,
		currencyCode: row.currency_code,
		id: row.id,
		name: row.name,
		periodEnd: row.period_end,
		periodStart: row.period_start,
		plannedMinor: row.planned_minor,
	});
}

class SqliteBudgetRepository implements BudgetRepository {
	constructor(private readonly database: Database) {}

	actualMinor(budget: Budget): number {
		const rows = this.database
			.query(
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
			) as ActualRow[];

		let total = 0n;
		for (const row of rows) {
			const amountMinor = BigInt(row.amount_minor);
			if (amountMinor < 0n) {
				total -= amountMinor;
			}
		}

		const result = Number(total);
		if (!Number.isSafeInteger(result)) {
			throw new BudgetAmountOutOfRangeError('actual');
		}

		return result;
	}

	create(budget: Budget): Budget {
		const create = this.database.transaction(() => {
			const overlap = this.database
				.query(
					`SELECT 1 FROM budgets
					WHERE book_id = ? AND account_id = ?
					AND category_id IS ? AND class_id IS ?
					AND period_start <= ? AND period_end >= ? LIMIT 1`
				)
				.get(
					budget.bookId,
					budget.accountId,
					budget.categoryId,
					budget.classId,
					budget.periodEnd,
					budget.periodStart
				);
			if (overlap) {
				throw new BudgetPeriodOverlapError();
			}

			this.database
				.query(
					`INSERT INTO budgets
						(id, book_id, account_id, category_id, class_id, name, period_start, period_end, planned_minor, currency_code)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					budget.id,
					budget.bookId,
					budget.accountId,
					budget.categoryId,
					budget.classId,
					budget.name,
					budget.periodStart,
					budget.periodEnd,
					budget.plannedMinor,
					budget.currencyCode
				);

			return budget;
		});

		try {
			return create();
		} catch (error) {
			if (error instanceof Error && error.message.includes('budget_period_overlap')) {
				throw new BudgetPeriodOverlapError();
			}
			throw error;
		}
	}

	find(bookId: string, id: string): Budget | undefined {
		const row = this.database
			.query('SELECT * FROM budgets WHERE book_id = ? AND id = ?')
			.get(bookId, id) as BudgetRow | null;

		return row ? toBudget(row) : undefined;
	}

	list(bookId: string, accountId?: string): Budget[] {
		const rows =
			accountId === undefined
				? (this.database
						.query(
							'SELECT * FROM budgets WHERE book_id = ? ORDER BY period_start, period_end, name COLLATE NOCASE, id'
						)
						.all(bookId) as BudgetRow[])
				: (this.database
						.query(
							'SELECT * FROM budgets WHERE book_id = ? AND account_id = ? ORDER BY period_start, period_end, name COLLATE NOCASE, id'
						)
						.all(bookId, accountId) as BudgetRow[]);

		return rows.map(row => toBudget(row));
	}
}

export { SqliteBudgetRepository };
