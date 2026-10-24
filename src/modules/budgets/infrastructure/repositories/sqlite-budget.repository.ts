import type { BudgetCriteria, BudgetDeleteCriteria, BudgetRepository } from '@modules/budgets/domain';
import { Budget, BudgetIdentityConflictError, BudgetPeriodOverlapError } from '@modules/budgets/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

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

function where(criteria: BudgetCriteria): { parameters: SQLQueryBindings[]; sql: string } {
	const clauses: string[] = [];
	const parameters: SQLQueryBindings[] = [];

	function add(column: string, value: null | number | string | undefined): void {
		if (value === undefined) {
			return;
		}
		if (value === null) {
			clauses.push(`${column} IS NULL`);

			return;
		}

		clauses.push(`${column} = ?`);
		parameters.push(value);
	}

	add('account_id', criteria.accountId);
	add('book_id', criteria.bookId);
	add('category_id', criteria.categoryId);
	add('class_id', criteria.classId);
	add('currency_code', criteria.currencyCode);
	add('id', criteria.id);
	add('name', criteria.name);
	add('period_end', criteria.periodEnd);
	add('period_start', criteria.periodStart);
	add('planned_minor', criteria.plannedMinor);

	return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
}

class SqliteBudgetRepository implements BudgetRepository {
	constructor(private readonly database: Database) {}

	delete({ bookId, id }: BudgetDeleteCriteria): boolean {
		return this.database.query('DELETE FROM budgets WHERE book_id = ? AND id = ?').run(bookId, id).changes > 0;
	}

	find(criteria: BudgetCriteria): Budget | undefined {
		return this.search(criteria)[0];
	}

	save(budget: Budget): void {
		const save = this.database.transaction(() => {
			const existing = this.database
				.query<{ book_id: string }, [string]>('SELECT book_id FROM budgets WHERE id = ?')
				.get(budget.id);
			if (existing && existing.book_id !== budget.bookId) {
				throw new BudgetIdentityConflictError();
			}

			const overlap = this.database
				.query(
					`SELECT 1 FROM budgets
				WHERE id != ? AND book_id = ? AND account_id = ?
				AND category_id IS ? AND class_id IS ?
				AND period_start <= ? AND period_end >= ? LIMIT 1`
				)
				.get(
					budget.id,
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

			if (existing) {
				this.database
					.query(
						`UPDATE budgets SET
							account_id = ?, category_id = ?, class_id = ?, name = ?, period_start = ?, period_end = ?,
							planned_minor = ?, currency_code = ?
						WHERE book_id = ? AND id = ?`
					)
					.run(
						budget.accountId,
						budget.categoryId,
						budget.classId,
						budget.name,
						budget.periodStart,
						budget.periodEnd,
						budget.plannedMinor,
						budget.currencyCode,
						budget.bookId,
						budget.id
					);

				return;
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
		});

		try {
			save();
		} catch (error) {
			if (error instanceof Error && error.message.includes('budget_period_overlap')) {
				throw new BudgetPeriodOverlapError();
			}
			throw error;
		}
	}

	search(criteria: BudgetCriteria = {}): Budget[] {
		const filter = where(criteria);
		const rows = this.database
			.query<BudgetRow, SQLQueryBindings[]>(
				`SELECT * FROM budgets${filter.sql} ORDER BY period_start, period_end, name COLLATE NOCASE, id`
			)
			.all(...filter.parameters);

		return rows.map(row => toBudget(row));
	}
}

export { SqliteBudgetRepository };
