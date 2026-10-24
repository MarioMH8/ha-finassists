import { ClassificationMother } from '@modules/classifications/domain/classification.mother';
import { MockClassificationRepository } from '@modules/classifications/infrastructure/repositories/mock-classification.repository';
import { describe, expect, it } from 'bun:test';

import { UpdateClassification } from './update-classification.use-case';

const ARCHIVED_AT = '2026-01-01T00:00:00.000Z';
const ROOT = JSON.parse('null') as null;

function createUseCase() {
	const repository = new MockClassificationRepository('category');
	repository.shouldHaveBookState('active');

	return { repository, useCase: new UpdateClassification(repository) };
}

describe('UpdateClassification', () => {
	describe('execute', () => {
		it('should rename the classification and keep its parent', () => {
			const { repository, useCase } = createUseCase();
			const current = ClassificationMother.create({ parentId: 'parent-1' });
			repository.shouldFind(current);

			const updated = useCase.execute('book-1', 'classification-1', { name: '  Food  ' });

			expect(updated).toEqual(current.rename('Food'));
			repository.assertSaveHasBeenCalledWith(updated);
		});

		it('should save the same classification when nothing changes', () => {
			const { repository, useCase } = createUseCase();
			const current = ClassificationMother.create();
			repository.shouldFind(current);

			expect(useCase.execute('book-1', 'classification-1', {})).toBe(current);
			repository.assertSaveHasBeenCalledWith(current);
		});

		it('should move the classification below an active parent', () => {
			const { repository, useCase } = createUseCase();
			const parent = ClassificationMother.create({ id: 'parent-1' });
			repository.shouldFindInOrder(ClassificationMother.create(), parent);

			const updated = useCase.execute('book-1', 'classification-1', { parentId: 'parent-1' });

			expect(updated.parentId).toBe('parent-1');
			repository.assertFindHasBeenCalledWith('book-1', 'parent-1');
			repository.assertIsSelfOrDescendantHasBeenCalledWith('book-1', 'classification-1', 'parent-1');
			repository.assertSaveHasBeenCalledWith(updated);
		});

		it('should move the classification to the root when the parent id is null', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFind(ClassificationMother.create({ parentId: 'parent-1' }));

			const updated = useCase.execute('book-1', 'classification-1', { parentId: ROOT });

			expect(updated.parentId).toBeNull();
			repository.assertSaveHasBeenCalledWith(updated);
		});

		it('should not look up the parent when it is unchanged', () => {
			const { repository, useCase } = createUseCase();
			const current = ClassificationMother.create({ parentId: 'parent-1' });
			repository.shouldFind(current);

			expect(useCase.execute('book-1', 'classification-1', { parentId: 'parent-1' })).toBe(current);
		});

		it('should fail with cycle when moving below itself or a descendant', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFindInOrder(ClassificationMother.create(), ClassificationMother.create({ id: 'child-1' }));
			repository.shouldBeSelfOrDescendant(true);

			expect(() => useCase.execute('book-1', 'classification-1', { parentId: 'child-1' })).toThrow(
				expect.objectContaining({ code: 'cycle' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should reject an invalid name before checking the book', () => {
			const { repository, useCase } = createUseCase();

			expect(() => useCase.execute('book-1', 'classification-1', { name: ' ' })).toThrow(
				expect.objectContaining({ code: 'invalid-name' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with book-not-found when the book does not exist', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState(undefined);

			expect(() => useCase.execute('book-1', 'classification-1', {})).toThrow(
				expect.objectContaining({ code: 'book-not-found' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with book-archived when the book is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState('archived');

			expect(() => useCase.execute('book-1', 'classification-1', {})).toThrow(
				expect.objectContaining({ code: 'book-archived' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with not-found when the classification does not exist', () => {
			const { repository, useCase } = createUseCase();

			expect(() => useCase.execute('book-1', 'missing', {})).toThrow(
				expect.objectContaining({ code: 'not-found' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with parent-not-found when the new parent does not exist', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFindInOrder(ClassificationMother.create(), undefined);

			expect(() => useCase.execute('book-1', 'classification-1', { parentId: 'missing' })).toThrow(
				expect.objectContaining({ code: 'parent-not-found' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with parent-archived when the new parent is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFindInOrder(
				ClassificationMother.create(),
				ClassificationMother.create({ archivedAt: ARCHIVED_AT, id: 'parent-1' })
			);

			expect(() => useCase.execute('book-1', 'classification-1', { parentId: 'parent-1' })).toThrow(
				expect.objectContaining({ code: 'parent-archived' })
			);
			repository.assertSaveHasNotBeenCalled();
		});
	});
});
