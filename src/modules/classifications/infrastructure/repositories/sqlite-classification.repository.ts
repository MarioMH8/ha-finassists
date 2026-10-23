import type { Database } from 'bun:sqlite';

import type { CategoryRepository, ClassificationKind, ClassificationRepository, ClassRepository } from '../../domain';
import { Classification } from '../../domain';

interface ClassificationRow {
	archived_at: null | string;
	book_id: string;
	id: string;
	name: string;
	parent_id: null | string;
}

// Identifiers are interpolated into SQL, so they come only from this closed map.
const schema = {
	category: { reference: 'category_id', table: 'categories' },
	class: { reference: 'class_id', table: 'classes' },
} as const satisfies Record<ClassificationKind, { reference: string; table: string }>;

function toClassification(row: ClassificationRow, kind: ClassificationKind): Classification {
	return Classification.reconstitute(kind, {
		archivedAt: row.archived_at,
		bookId: row.book_id,
		id: row.id,
		name: row.name,
		parentId: row.parent_id,
	});
}

class SqliteClassificationRepository<
	K extends ClassificationKind = ClassificationKind,
> implements ClassificationRepository<K> {
	private readonly reference: string;
	private readonly table: string;

	constructor(
		private readonly database: Database,
		readonly kind: K
	) {
		this.table = schema[kind].table;
		this.reference = schema[kind].reference;
	}

	archiveSubtree(bookId: string, id: string, archivedAt: string): number {
		const archive = this.database.transaction(() => {
			return this.database
				.query(
					`WITH RECURSIVE subtree(id) AS (
						SELECT id FROM ${this.table} WHERE book_id = ?1 AND id = ?2
						UNION
						SELECT child.id FROM ${this.table} child JOIN subtree ON child.book_id = ?1 AND child.parent_id = subtree.id
					)
					UPDATE ${this.table} SET archived_at = ?3
					WHERE book_id = ?1 AND archived_at IS NULL AND id IN (SELECT id FROM subtree)`
				)
				.run(bookId, id, archivedAt).changes;
		});

		return archive();
	}

	bookState(bookId: string): 'active' | 'archived' | undefined {
		const row = this.database.query('SELECT archived_at FROM books WHERE id = ?').get(bookId) as null | {
			archived_at: null | string;
		};
		if (!row) {
			return undefined;
		}

		return row.archived_at === null ? 'active' : 'archived';
	}

	create(classification: Classification): void {
		this.database
			.query(`INSERT INTO ${this.table} (id, book_id, parent_id, name, archived_at) VALUES (?, ?, ?, ?, ?)`)
			.run(
				classification.id,
				classification.bookId,
				classification.parentId,
				classification.name,
				classification.archivedAt
			);
	}

	delete(bookId: string, id: string): boolean {
		return (
			this.database.query(`DELETE FROM ${this.table} WHERE book_id = ? AND id = ?`).run(bookId, id).changes > 0
		);
	}

	find(bookId: string, id: string): Classification | undefined {
		const row = this.database
			.query(`SELECT * FROM ${this.table} WHERE book_id = ? AND id = ?`)
			.get(bookId, id) as ClassificationRow | null;

		return row ? toClassification(row, this.kind) : undefined;
	}

	hasChildren(bookId: string, id: string): boolean {
		return (
			this.database
				.query(`SELECT 1 FROM ${this.table} WHERE book_id = ? AND parent_id = ? LIMIT 1`)
				.get(bookId, id) !== null
		);
	}

	isInUse(bookId: string, id: string): boolean {
		return (
			this.database
				.query(`SELECT 1 FROM transaction_parts WHERE book_id = ? AND ${this.reference} = ? LIMIT 1`)
				.get(bookId, id) !== null
		);
	}

	isSelfOrDescendant(bookId: string, ancestorId: string, candidateId: string): boolean {
		// UNION (not UNION ALL) deduplicates rows so the walk terminates even on corrupt cyclic data.
		return (
			this.database
				.query(
					`WITH RECURSIVE chain(id, parent_id) AS (
						SELECT id, parent_id FROM ${this.table} WHERE book_id = ?1 AND id = ?3
						UNION
						SELECT node.id, node.parent_id FROM ${this.table} node JOIN chain ON node.book_id = ?1 AND node.id = chain.parent_id
					)
					SELECT 1 FROM chain WHERE id = ?2 LIMIT 1`
				)
				.get(bookId, ancestorId, candidateId) !== null
		);
	}

	list(bookId: string, options: { includeArchived?: boolean } = {}): Classification[] {
		const filter = options.includeArchived ? '' : ' AND archived_at IS NULL';
		const rows = this.database
			.query(`SELECT * FROM ${this.table} WHERE book_id = ?${filter} ORDER BY name COLLATE NOCASE, name, id`)
			.all(bookId) as ClassificationRow[];

		return rows.map(row => toClassification(row, this.kind));
	}

	save(classification: Classification): void {
		this.database
			.query(`UPDATE ${this.table} SET name = ?, parent_id = ?, archived_at = ? WHERE book_id = ? AND id = ?`)
			.run(
				classification.name,
				classification.parentId,
				classification.archivedAt,
				classification.bookId,
				classification.id
			);
	}
}

class SqliteCategoryRepository extends SqliteClassificationRepository<'category'> implements CategoryRepository {
	constructor(database: Database) {
		super(database, 'category');
	}
}

class SqliteClassRepository extends SqliteClassificationRepository<'class'> implements ClassRepository {
	constructor(database: Database) {
		super(database, 'class');
	}
}

export { SqliteCategoryRepository, SqliteClassificationRepository, SqliteClassRepository };
