import { describe, expect, it } from 'bun:test';

import { classificationNameMaxLength, createClassification, normalizeClassificationName } from './classification';
import { buildClassificationTree } from './classification-tree';

const JSON_NULL = JSON.parse('null') as null;

describe('classification domain', () => {
	it('trims names and enforces the 1-80 character bounds per kind', () => {
		expect(normalizeClassificationName('category', '  Groceries  ')).toBe('Groceries');
		expect(normalizeClassificationName('class', 'a'.repeat(classificationNameMaxLength))).toHaveLength(80);
		expect(() => normalizeClassificationName('category', ' '.repeat(3))).toThrow(
			'Category name must contain between 1 and 80 characters'
		);
		expect(() => normalizeClassificationName('class', 'a'.repeat(81))).toThrow(
			'Class name must contain between 1 and 80 characters'
		);
	});

	it('creates root classifications by default', () => {
		expect(createClassification('category', { bookId: 'b', id: 'c1', name: ' Food ' })).toEqual({
			archivedAt: JSON_NULL,
			bookId: 'b',
			id: 'c1',
			name: 'Food',
			parentId: JSON_NULL,
		});
		expect(() => createClassification('class', { bookId: '', id: 'c1', name: 'x' })).toThrow();
		expect(() => createClassification('class', { bookId: 'b', id: ' ', name: 'x' })).toThrow();
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
