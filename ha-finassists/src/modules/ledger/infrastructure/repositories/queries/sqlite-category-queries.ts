import type { CategoryCriteria } from '@modules/ledger/domain';
import type { SQLQueryBindings } from 'bun:sqlite';

class SqliteCategoryQueries {
	private constructor() {}

	static where(criteria: CategoryCriteria): { parameters: SQLQueryBindings[]; sql: string } {
		return criteria.kind === undefined
			? { parameters: [], sql: '' }
			: { parameters: [criteria.kind], sql: ' WHERE categories.kind = ?' };
	}
}

export { SqliteCategoryQueries };
