import { ClassificationMother } from '@modules/classifications/domain/classification.mother';
import { MockClassificationRepository } from '@modules/classifications/infrastructure/repositories/mock-classification.repository';
import { describe, expect, it } from 'bun:test';

import { ListClassifications, ListClassificationTree } from './list-classifications.use-case';

function createRepository() {
	const repository = new MockClassificationRepository('category');
	repository.shouldHaveBookState('active');

	return repository;
}

describe('ListClassifications', () => {
	describe('execute', () => {
		it('should list the classifications of the book', () => {
			const repository = createRepository();
			const classifications = [ClassificationMother.create()];
			repository.shouldList(classifications);
			const useCase = new ListClassifications(repository);

			expect(useCase.execute('book-1')).toEqual(classifications);
			repository.assertListHasBeenCalledWith('book-1', {});
		});

		it('should forward the include-archived option', () => {
			const repository = createRepository();
			const useCase = new ListClassifications(repository);

			useCase.execute('book-1', { includeArchived: true });

			repository.assertListHasBeenCalledWith('book-1', { includeArchived: true });
		});

		it('should fail with book-not-found when the book does not exist', () => {
			const repository = new MockClassificationRepository('category');
			const useCase = new ListClassifications(repository);

			expect(() => useCase.execute('book-1')).toThrow(expect.objectContaining({ code: 'book-not-found' }));
		});

		it('should list the classifications of an archived book', () => {
			const repository = createRepository();
			repository.shouldHaveBookState('archived');
			const useCase = new ListClassifications(repository);

			expect(useCase.execute('book-1')).toEqual([]);
		});
	});
});

describe('ListClassificationTree', () => {
	describe('execute', () => {
		it('should nest the listed classifications below their parents', () => {
			const repository = createRepository();
			repository.shouldList([
				ClassificationMother.create({ id: 'root' }),
				ClassificationMother.create({ id: 'child', parentId: 'root' }),
			]);
			const useCase = new ListClassificationTree(repository);

			const tree = useCase.execute('book-1', { includeArchived: true });

			expect(tree).toHaveLength(1);
			expect(tree[0]?.id).toBe('root');
			expect(tree[0]?.children.map(node => node.id)).toEqual(['child']);
			repository.assertListHasBeenCalledWith('book-1', { includeArchived: true });
		});

		it('should fail with book-not-found when the book does not exist', () => {
			const repository = new MockClassificationRepository('category');
			const useCase = new ListClassificationTree(repository);

			expect(() => useCase.execute('book-1')).toThrow(expect.objectContaining({ code: 'book-not-found' }));
		});
	});
});
