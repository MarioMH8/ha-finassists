import type { TransactionCriteria } from '@modules/ledger/domain';
import type { SQLQueryBindings } from 'bun:sqlite';

class SqliteTransactionQueries {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static where(criteria: TransactionCriteria): { parameters: SQLQueryBindings[]; sql: string } {
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
		if (criteria.fromDate !== undefined) {
			clauses.push('transaction_date >= ?');
			parameters.push(criteria.fromDate);
		}
		if (criteria.toDate !== undefined) {
			clauses.push('transaction_date <= ?');
			parameters.push(criteria.toDate);
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

export { SqliteTransactionQueries };
