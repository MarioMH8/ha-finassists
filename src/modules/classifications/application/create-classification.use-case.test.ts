import { describe, expect, it } from 'bun:test';

import { ClassificationError } from '../domain';
import { ClassificationMother } from '../domain/classification.mother';
import { MockClassificationRepository } from '../infrastructure/repositories/mock-classification.repository';
import { CreateClassification } from './create-classification.use-case';

const ARCHIVED_AT = '2026-01-01T00:00:00.000Z';
const NO_PARENT = JSON.parse('null') as null;

function createUseCase(kind: 'category' | 'class' = 'category') {
	const repository = new MockClassificationRepository(kind);
	repository.shouldHaveBookState('active');

	return { repository, useCase: new CreateClassification(repository) };
}

describe('CreateClassification', () => {
	describe('execute', () => {
		it('should create and persist a root classification of the repository kind', () => {
			const { repository, useCase } = createUseCase();

			const classification = useCase.execute({ bookId: 'book-1', name: '  Groceries  ' });

			expect(classification).toMatchObject({ bookId: 'book-1', name: 'Groceries' });
			expect(classification.parentId).toBeNull();
			expect(classification.archivedAt).toBeNull();
			repository.assertBookStateHasBeenCalledWith('book-1');
			repository.assertCreateHasBeenCalledWith(classification);
			repository.assertFindHasNotBeenCalled();
		});

		it('should create a root classification when the parent id is null', () => {
			const { repository, useCase } = createUseCase();

			const classification = useCase.execute({ bookId: 'book-1', name: 'Groceries', parentId: NO_PARENT });

			expect(classification.parentId).toBeNull();
			repository.assertCreateHasBeenCalledWith(classification);
			repository.assertFindHasNotBeenCalled();
		});

		it('should nest the classification below an active parent', () => {
			const { repository, useCase } = createUseCase('class');
			repository.shouldFind(ClassificationMother.create({ id: 'parent-1' }, 'class'));

			const classification = useCase.execute({ bookId: 'book-1', name: 'Vacation', parentId: 'parent-1' });

			expect(classification.parentId).toBe('parent-1');
			repository.assertFindHasBeenCalledWith('book-1', 'parent-1');
			repository.assertCreateHasBeenCalledWith(classification);
		});

		it('should reject an invalid name before checking the book', () => {
			const { repository, useCase } = createUseCase();

			expect(() => useCase.execute({ bookId: 'book-1', name: ' '.repeat(3) })).toThrow(
				expect.objectContaining({ code: 'invalid-name' })
			);
			repository.assertCreateHasNotBeenCalled();
		});

		it('should fail with book-not-found when the book does not exist', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState(undefined);

			expect(() => useCase.execute({ bookId: 'book-1', name: 'Groceries' })).toThrow(ClassificationError);
			expect(() => useCase.execute({ bookId: 'book-1', name: 'Groceries' })).toThrow(
				expect.objectContaining({ code: 'book-not-found' })
			);
			repository.assertCreateHasNotBeenCalled();
		});

		it('should fail with book-archived when the book is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState('archived');

			expect(() => useCase.execute({ bookId: 'book-1', name: 'Groceries' })).toThrow(
				expect.objectContaining({ code: 'book-archived' })
			);
			repository.assertCreateHasNotBeenCalled();
		});

		it('should fail with parent-not-found when the parent does not exist', () => {
			const { repository, useCase } = createUseCase();

			expect(() => useCase.execute({ bookId: 'book-1', name: 'Groceries', parentId: 'missing' })).toThrow(
				expect.objectContaining({ code: 'parent-not-found' })
			);
			repository.assertCreateHasNotBeenCalled();
		});

		it('should fail with parent-archived when the parent is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFind(ClassificationMother.create({ archivedAt: ARCHIVED_AT, id: 'parent-1' }));

			expect(() => useCase.execute({ bookId: 'book-1', name: 'Groceries', parentId: 'parent-1' })).toThrow(
				expect.objectContaining({ code: 'parent-archived' })
			);
			repository.assertCreateHasNotBeenCalled();
		});
	});
});
