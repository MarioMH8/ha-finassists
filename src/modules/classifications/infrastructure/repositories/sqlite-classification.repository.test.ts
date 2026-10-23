import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import {
	ArchiveClassification,
	CreateClassification,
	DeleteClassification,
	ListClassifications,
	ListClassificationTree,
	RestoreClassification,
	UpdateClassification,
} from '../../application';
import type { ClassificationErrorCode, ClassificationKind } from '../../domain';
import { ClassificationError } from '../../domain';
import { SqliteCategoryRepository, SqliteClassRepository } from './sqlite-classification.repository';

const JSON_NULL = JSON.parse('null') as null;

function setup() {
	const database = new Database(':memory:');
	migrateDatabase(database);
	database.run(
		`INSERT INTO books (id, name, currency_code, is_default) VALUES ('b1', 'One', 'EUR', 0), ('b2', 'Two', 'EUR', 0)`
	);
	const categories = new SqliteCategoryRepository(database);
	const classes = new SqliteClassRepository(database);

	return { categories, classes, database };
}

function codeOf(action: () => unknown): ClassificationErrorCode | undefined {
	try {
		action();
	} catch (error) {
		if (error instanceof ClassificationError) {
			return error.code;
		}

		throw error;
	}

	return undefined;
}

function useCases(repository: SqliteCategoryRepository | SqliteClassRepository) {
	return {
		archive: new ArchiveClassification(repository),
		create: new CreateClassification(repository),
		delete: new DeleteClassification(repository),
		list: new ListClassifications(repository),
		restore: new RestoreClassification(repository),
		tree: new ListClassificationTree(repository),
		update: new UpdateClassification(repository),
	};
}

function useInTransaction(database: Database, kind: ClassificationKind, bookId: string, classificationId: string) {
	database.run(
		`INSERT OR IGNORE INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES ('acc-${bookId}', ?, 'Main', 'checking', 0)`,
		[bookId]
	);
	database.run(
		`INSERT INTO transactions (id, book_id, account_id, transaction_date, amount_minor) VALUES ('tx-${classificationId}', ?, 'acc-${bookId}', '2025-01-01', -100)`,
		[bookId]
	);
	database.run(
		`INSERT INTO transaction_parts (id, book_id, transaction_id, ${kind === 'category' ? 'category_id' : 'class_id'}, amount_minor) VALUES ('part-${classificationId}', ?, 'tx-${classificationId}', ?, -100)`,
		[bookId, classificationId]
	);
}

describe.each([['category'], ['class']] as const)('%s classification use cases', kind => {
	function setupKind() {
		const context = setup();
		const repository = kind === 'category' ? context.categories : context.classes;

		return { ...context, repository, uc: useCases(repository) };
	}

	it('creates trimmed, bounded names with optional active parents in the same book', () => {
		const { database, uc } = setupKind();
		const parent = uc.create.execute({ bookId: 'b1', name: '  Home  ' });
		const child = uc.create.execute({ bookId: 'b1', name: 'Rent', parentId: parent.id });

		expect(parent).toMatchObject({ archivedAt: JSON_NULL, name: 'Home', parentId: JSON_NULL });
		expect(child.parentId).toBe(parent.id);
		expect(() => uc.create.execute({ bookId: 'b1', name: ' '.repeat(3) })).toThrow('between 1 and 80 characters');
		expect(() => uc.create.execute({ bookId: 'b1', name: 'x'.repeat(81) })).toThrow('between 1 and 80 characters');
		database.close();
	});

	it('enforces book existence, archived books and strict book ownership', () => {
		const { database, uc } = setupKind();
		const parent = uc.create.execute({ bookId: 'b1', name: 'Home' });

		expect(codeOf(() => uc.create.execute({ bookId: 'missing', name: 'X' }))).toBe('book-not-found');
		expect(codeOf(() => uc.create.execute({ bookId: 'b2', name: 'X', parentId: parent.id }))).toBe(
			'parent-not-found'
		);
		expect(codeOf(() => uc.create.execute({ bookId: 'b1', name: 'X', parentId: 'nope' }))).toBe('parent-not-found');
		expect(codeOf(() => uc.update.execute('b2', parent.id, { name: 'Hijack' }))).toBe('not-found');
		expect(codeOf(() => uc.archive.execute('b2', parent.id))).toBe('not-found');
		expect(codeOf(() => uc.delete.execute('b2', parent.id))).toBe('not-found');
		expect(uc.list.execute('b2')).toEqual([]);
		expect(codeOf(() => uc.list.execute('missing'))).toBe('book-not-found');

		const other = uc.create.execute({ bookId: 'b2', name: 'Other' });
		expect(codeOf(() => uc.update.execute('b1', parent.id, { parentId: other.id }))).toBe('parent-not-found');

		database.run('UPDATE books SET archived_at = ? WHERE id = ?', ['2025-01-01T00:00:00.000Z', 'b1']);
		expect(codeOf(() => uc.create.execute({ bookId: 'b1', name: 'X' }))).toBe('book-archived');
		expect(codeOf(() => uc.update.execute('b1', parent.id, { name: 'Y' }))).toBe('book-archived');
		expect(codeOf(() => uc.archive.execute('b1', parent.id))).toBe('book-archived');
		expect(codeOf(() => uc.delete.execute('b1', parent.id))).toBe('book-archived');
		expect(uc.list.execute('b1')).toHaveLength(1);
		database.close();
	});

	it('renames and reparents, including moving to the root', () => {
		const { database, uc } = setupKind();
		const a = uc.create.execute({ bookId: 'b1', name: 'A' });
		const b = uc.create.execute({ bookId: 'b1', name: 'B' });
		const leaf = uc.create.execute({ bookId: 'b1', name: 'Leaf', parentId: a.id });

		expect(uc.update.execute('b1', leaf.id, { parentId: b.id })).toMatchObject({ name: 'Leaf', parentId: b.id });
		expect(uc.update.execute('b1', leaf.id, { name: ' Renamed ' })).toMatchObject({
			name: 'Renamed',
			parentId: b.id,
		});
		expect(uc.update.execute('b1', leaf.id, { parentId: JSON_NULL }).parentId).toBeNull();
		expect(() => uc.update.execute('b1', leaf.id, { name: '' })).toThrow('between 1 and 80 characters');
		database.close();
	});

	it('prevents cycles when reparenting', () => {
		const { database, uc } = setupKind();
		const a = uc.create.execute({ bookId: 'b1', name: 'A' });
		const b = uc.create.execute({ bookId: 'b1', name: 'B', parentId: a.id });
		const c = uc.create.execute({ bookId: 'b1', name: 'C', parentId: b.id });

		expect(codeOf(() => uc.update.execute('b1', a.id, { parentId: a.id }))).toBe('cycle');
		expect(codeOf(() => uc.update.execute('b1', a.id, { parentId: c.id }))).toBe('cycle');
		expect(codeOf(() => uc.update.execute('b1', b.id, { parentId: c.id }))).toBe('cycle');
		expect(uc.update.execute('b1', c.id, { parentId: a.id }).parentId).toBe(a.id);
		database.close();
	});

	it('lists in a stable, locale-independent order and builds a tree', () => {
		const { database, uc } = setupKind();
		const zed = uc.create.execute({ bookId: 'b1', name: 'zed' });
		uc.create.execute({ bookId: 'b1', name: 'Beta' });
		uc.create.execute({ bookId: 'b1', name: 'alpha' });
		uc.create.execute({ bookId: 'b1', name: 'Alpha' });
		uc.create.execute({ bookId: 'b1', name: 'child b', parentId: zed.id });
		uc.create.execute({ bookId: 'b1', name: 'Child A', parentId: zed.id });

		expect(uc.list.execute('b1').map(item => item.name)).toEqual([
			'Alpha',
			'alpha',
			'Beta',
			'Child A',
			'child b',
			'zed',
		]);
		expect(uc.list.execute('b1')).toEqual(uc.list.execute('b1'));

		const roots = uc.tree.execute('b1');
		expect(roots.map(node => node.name)).toEqual(['Alpha', 'alpha', 'Beta', 'zed']);
		expect(roots[3]?.children.map(node => node.name)).toEqual(['Child A', 'child b']);
		database.close();
	});

	it('archives the whole subtree, hides it by default and restores top-down', () => {
		const { database, uc } = setupKind();
		const a = uc.create.execute({ bookId: 'b1', name: 'A' });
		const b = uc.create.execute({ bookId: 'b1', name: 'B', parentId: a.id });
		const c = uc.create.execute({ bookId: 'b1', name: 'C', parentId: b.id });
		const sibling = uc.create.execute({ bookId: 'b1', name: 'S' });

		const archived = uc.archive.execute('b1', a.id);
		expect(archived.archivedAt).not.toBeNull();
		expect(uc.archive.execute('b1', a.id)).toEqual(archived);
		expect(uc.list.execute('b1').map(item => item.id)).toEqual([sibling.id]);
		expect(uc.list.execute('b1', { includeArchived: true })).toHaveLength(4);
		expect(codeOf(() => uc.create.execute({ bookId: 'b1', name: 'X', parentId: c.id }))).toBe('parent-archived');
		expect(codeOf(() => uc.update.execute('b1', sibling.id, { parentId: b.id }))).toBe('parent-archived');
		expect(codeOf(() => uc.restore.execute('b1', b.id))).toBe('parent-archived');

		expect(uc.restore.execute('b1', a.id).archivedAt).toBeNull();
		expect(uc.restore.execute('b1', b.id).archivedAt).toBeNull();
		expect(
			uc.list
				.execute('b1')
				.map(item => item.id)
				.toSorted((x, y) => x.localeCompare(y))
		).toEqual([a.id, b.id, sibling.id].toSorted((x, y) => x.localeCompare(y)));
		expect(uc.restore.execute('b1', a.id).archivedAt).toBeNull();
		database.close();
	});

	it('archives in-use classifications but refuses to hard-delete them', () => {
		const { database, uc } = setupKind();
		const used = uc.create.execute({ bookId: 'b1', name: 'Used' });
		useInTransaction(database, kind, 'b1', used.id);

		expect(codeOf(() => uc.delete.execute('b1', used.id))).toBe('in-use');
		expect(uc.archive.execute('b1', used.id).archivedAt).not.toBeNull();
		expect(codeOf(() => uc.delete.execute('b1', used.id))).toBe('in-use');
		expect(uc.list.execute('b1', { includeArchived: true })).toHaveLength(1);
		database.close();
	});

	it('refuses to delete classifications with children (archived or not) and deletes unused leaves', () => {
		const { database, uc } = setupKind();
		const parent = uc.create.execute({ bookId: 'b1', name: 'Parent' });
		const child = uc.create.execute({ bookId: 'b1', name: 'Child', parentId: parent.id });

		expect(codeOf(() => uc.delete.execute('b1', parent.id))).toBe('has-children');
		uc.archive.execute('b1', parent.id);
		expect(codeOf(() => uc.delete.execute('b1', parent.id))).toBe('has-children');

		expect(() => uc.delete.execute('b1', child.id)).not.toThrow();
		expect(() => uc.delete.execute('b1', parent.id)).not.toThrow();
		expect(uc.list.execute('b1', { includeArchived: true })).toEqual([]);
		expect(codeOf(() => uc.delete.execute('b1', parent.id))).toBe('not-found');
		database.close();
	});
});

describe('categories and classes are distinct dimensions', () => {
	it('keeps trees, ids and usage independent', () => {
		const { categories, classes, database } = setup();
		const categoryUseCases = useCases(categories);
		const classUseCases = useCases(classes);
		const category = categoryUseCases.create.execute({ bookId: 'b1', name: 'Food' });

		expect(classUseCases.list.execute('b1')).toEqual([]);
		expect(codeOf(() => classUseCases.create.execute({ bookId: 'b1', name: 'X', parentId: category.id }))).toBe(
			'parent-not-found'
		);
		expect(codeOf(() => classUseCases.update.execute('b1', category.id, { name: 'Y' }))).toBe('not-found');

		const clazz = classUseCases.create.execute({ bookId: 'b1', name: 'Food' });
		useInTransaction(database, 'category', 'b1', category.id);

		expect(codeOf(() => categoryUseCases.delete.execute('b1', category.id))).toBe('in-use');
		expect(() => classUseCases.delete.execute('b1', clazz.id)).not.toThrow();
		database.close();
	});
});

describe('sqlite integrity backstop', () => {
	it('rejects cross-book parents and hard deletes of referenced rows at the schema level', () => {
		const { categories, database } = setup();
		const uc = useCases(categories);
		const parent = uc.create.execute({ bookId: 'b1', name: 'P' });
		const child = { archivedAt: JSON_NULL, bookId: 'b2', id: 'raw', name: 'Raw', parentId: parent.id };

		expect(() => categories.create(child)).toThrow();
		useInTransaction(database, 'category', 'b1', parent.id);
		expect(() => categories.delete('b1', parent.id)).toThrow();
		database.close();
	});
});
