import { describe, expect, it } from 'bun:test';

import { ClassificationMother } from '../domain/classification.mother';
import { MockClassificationRepository } from '../infrastructure/repositories/mock-classification.repository';
import { RestoreClassification } from './restore-classification.use-case';

const ARCHIVED_AT = '2026-01-01T00:00:00.000Z';

function createUseCase() {
	const repository = new MockClassificationRepository('category');
	repository.shouldHaveBookState('active');

	return { repository, useCase: new RestoreClassification(repository) };
}

describe('RestoreClassification', () => {
	describe('execute', () => {
		it('should persist and return an archived root classification as active', () => {
			const { repository, useCase } = createUseCase();
			const archived = ClassificationMother.create({ archivedAt: ARCHIVED_AT });
			repository.shouldFind(archived);

			const restored = useCase.execute('book-1', 'classification-1');

			expect(restored.archivedAt).toBeNull();
			expect(restored).toEqual(archived.restore(undefined));
			repository.assertSaveHasBeenCalledWith(restored);
		});

		it('should restore a nested classification when its parent is active', () => {
			const { repository, useCase } = createUseCase();
			const parent = ClassificationMother.create({ id: 'parent-1' });
			const archived = ClassificationMother.create({ archivedAt: ARCHIVED_AT, parentId: 'parent-1' });
			repository.shouldFindInOrder(archived, parent);

			const restored = useCase.execute('book-1', 'classification-1');

			expect(restored.archivedAt).toBeNull();
			expect(restored.parentId).toBe('parent-1');
			repository.assertFindHasBeenCalledWith('book-1', 'parent-1');
			repository.assertSaveHasBeenCalledWith(restored);
		});

		it('should return an active classification without saving', () => {
			const { repository, useCase } = createUseCase();
			const active = ClassificationMother.create();
			repository.shouldFind(active);

			expect(useCase.execute('book-1', 'classification-1')).toBe(active);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with book-not-found when the book does not exist', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState(undefined);

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'book-not-found' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with book-archived when the book is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState('archived');

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'book-archived' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with not-found when the classification does not exist', () => {
			const { repository, useCase } = createUseCase();

			expect(() => useCase.execute('book-1', 'missing')).toThrow(expect.objectContaining({ code: 'not-found' }));
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with parent-not-found when the parent no longer exists', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFindInOrder(
				ClassificationMother.create({ archivedAt: ARCHIVED_AT, parentId: 'parent-1' }),
				undefined
			);

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'parent-not-found' })
			);
			repository.assertSaveHasNotBeenCalled();
		});

		it('should fail with parent-archived when the parent is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFindInOrder(
				ClassificationMother.create({ archivedAt: ARCHIVED_AT, parentId: 'parent-1' }),
				ClassificationMother.create({ archivedAt: ARCHIVED_AT, id: 'parent-1' })
			);

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'parent-archived' })
			);
			repository.assertSaveHasNotBeenCalled();
		});
	});
});
