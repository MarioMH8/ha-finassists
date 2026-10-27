import type { ScheduledTransactionCriteria } from '@modules/ledger/domain';
import type { SQLQueryBindings } from 'bun:sqlite';

class SqliteScheduledTransactionQueries {
	private constructor() {}

	static where(criteria: ScheduledTransactionCriteria): { parameters: SQLQueryBindings[]; sql: string } {
		const clauses: string[] = [];
		const parameters: SQLQueryBindings[] = [];
		if (criteria.kind !== undefined) {
			clauses.push('kind = ?');
			parameters.push(criteria.kind);
		}
		if (criteria.categoryId !== undefined) {
			clauses.push('category_id = ?');
			parameters.push(criteria.categoryId);
		}
		if (criteria.status !== undefined) {
			clauses.push('status = ?');
			parameters.push(criteria.status);
		}
		if (criteria.postingMode !== undefined) {
			clauses.push('posting_mode = ?');
			parameters.push(criteria.postingMode);
		}
		if (criteria.dueThrough !== undefined) {
			clauses.push('next_due_date IS NOT NULL AND next_due_date <= ?');
			parameters.push(criteria.dueThrough);
		}
		const search = criteria.search?.trim();
		if (search !== undefined && search !== '') {
			clauses.push(String.raw`description COLLATE NOCASE LIKE ? ESCAPE '\'`);
			parameters.push(`%${this.escapeLike(search)}%`);
		}

		return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
	}

	private static escapeLike(value: string): string {
		return value
			.replaceAll('\\', '\\\\')
			.replaceAll('%', String.raw`\%`)
			.replaceAll('_', String.raw`\_`);
	}
}

export { SqliteScheduledTransactionQueries };
