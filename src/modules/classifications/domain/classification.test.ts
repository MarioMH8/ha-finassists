import { describe, expect, it } from 'bun:test';

import { Classification, classificationNameMaxLength } from './classification';
import { ClassificationError } from './classification.error';
import { ClassificationMother } from './classification.mother';
import { buildClassificationTree } from './classification-tree';

const JSON_NULL = JSON.parse('null') as null;

describe('classification domain', () => {
	it('trims names and enforces the 1-80 character bounds per kind', () => {
		expect(Classification.normalizeName('category', '  Groceries  ')).toBe('Groceries');
		expect(Classification.normalizeName('class', 'a'.repeat(classificationNameMaxLength))).toHaveLength(80);
		expect(() => Classification.normalizeName('category', ' '.repeat(3))).toThrow(
			'Category name must contain between 1 and 80 characters'
		);
		expect(() => Classification.normalizeName('class', 'a'.repeat(81))).toThrow(
			'Class name must contain between 1 and 80 characters'
		);
	});

	it('counts Unicode code points when enforcing name length', () => {
		expect(Classification.create('category', { bookId: 'b', id: 'c1', name: '😀'.repeat(80) }).name).toBe(
			'😀'.repeat(80)
		);
		expect(() => Classification.create('category', { bookId: 'b', id: 'c2', name: '😀'.repeat(81) })).toThrow(
			ClassificationError
		);
	});

	it('creates immutable classification values', () => {
		const classification = ClassificationMother.create();

		expect(Object.isFrozen(classification)).toBe(true);
	});

	it('reports invalid identity and names with semantic domain errors', () => {
		expect(() => Classification.create('class', { bookId: '', id: 'c1', name: 'Valid' })).toThrow(
			ClassificationError
		);
		expect(() => Classification.create('class', { bookId: 'b', id: 'c1', name: ' ' })).toThrow(ClassificationError);
	});

	it('creates root classifications by default', () => {
		expect(Classification.create('category', { bookId: 'b', id: 'c1', name: ' Food ' })).toMatchObject({
			archivedAt: JSON_NULL,
			bookId: 'b',
			id: 'c1',
			name: 'Food',
			parentId: JSON_NULL,
		});
		expect(() => Classification.create('class', { bookId: '', id: 'c1', name: 'x' })).toThrow(ClassificationError);
		expect(() => Classification.create('class', { bookId: 'b', id: ' ', name: 'x' })).toThrow(ClassificationError);
	});

	it('renames, reparents and transitions lifecycle state without mutating prior values', () => {
		const parent = Classification.create('category', { bookId: 'b', id: 'p', name: 'Parent' });
		const child = Classification.create('category', { bookId: 'b', id: 'c', name: 'Child' });
		const renamed = child.rename(' Renamed ');
		const reparented = renamed.reparent(parent, false);
		const archived = reparented.archive('2025-01-01T00:00:00.000Z');
		const restored = archived.restore(parent);

		expect(child.name).toBe('Child');
		expect(child.parentId).toBeNull();
		expect(restored).toMatchObject({ archivedAt: JSON_NULL, name: 'Renamed', parentId: parent.id });
		expect(Object.isFrozen(restored)).toBe(true);
		expect(() => child.reparent(parent, true)).toThrow(ClassificationError);
		expect(() => child.reparent(ClassificationMother.create({ bookId: 'other-book' }), false)).toThrow(
			ClassificationError
		);
		const archivedParent = parent.archive('2025-01-01T00:00:00.000Z');
		expect(() => child.reparent(archivedParent, false)).toThrow(ClassificationError);
		expect(() => archived.restore(archivedParent)).toThrow(ClassificationError);
		expect(child.archive('2025-01-01T00:00:00.000Z').archive('2025-02-01T00:00:00.000Z').archivedAt).toBe(
			'2025-01-01T00:00:00.000Z'
		);
	});

	it('builds a forest keeping input order and promoting orphans to roots', () => {
		const base = { archivedAt: JSON_NULL, bookId: 'b' };
		const tree = buildClassificationTree([
			{ ...base, id: 'a', name: 'A', parentId: JSON_NULL },
			{ ...base, id: 'a2', name: 'A2', parentId: 'a' },
			{ ...base, id: 'a1', name: 'A1', parentId: 'a' },
			{ ...base, id: 'o', name: 'Orphan', parentId: 'missing' },
		]);

		expect(tree.map(node => node.id)).toEqual(['a', 'o']);
		expect(tree[0]?.children.map(node => node.id)).toEqual(['a2', 'a1']);
	});
});
