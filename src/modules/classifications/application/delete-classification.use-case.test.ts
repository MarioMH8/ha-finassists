import { ClassificationMother } from '@modules/classifications/domain/classification.mother';
import { MockClassificationRepository } from '@modules/classifications/infrastructure/repositories/mock-classification.repository';
import { describe, expect, it } from 'bun:test';

import { DeleteClassification } from './delete-classification.use-case';

function createUseCase() {
	const repository = new MockClassificationRepository('category');
	repository.shouldHaveBookState('active');
	repository.shouldFind(ClassificationMother.create());

	return { repository, useCase: new DeleteClassification(repository) };
}

describe('DeleteClassification', () => {
	describe('execute', () => {
		it('should delete an unused leaf classification', () => {
			const { repository, useCase } = createUseCase();

			useCase.execute('book-1', 'classification-1');

			repository.assertFindHasBeenCalledWith('book-1', 'classification-1');
			repository.assertHasChildrenHasBeenCalledWith('book-1', 'classification-1');
			repository.assertIsInUseHasBeenCalledWith('book-1', 'classification-1');
			repository.assertDeleteHasBeenCalledWith('book-1', 'classification-1');
		});

		it('should fail with book-not-found when the book does not exist', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState(undefined);

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'book-not-found' })
			);
			repository.assertDeleteHasNotBeenCalled();
		});

		it('should fail with book-archived when the book is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState('archived');

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'book-archived' })
			);
			repository.assertDeleteHasNotBeenCalled();
		});

		it('should fail with not-found when the classification does not exist', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldFind(undefined);

			expect(() => useCase.execute('book-1', 'missing')).toThrow(expect.objectContaining({ code: 'not-found' }));
			repository.assertDeleteHasNotBeenCalled();
		});

		it('should fail with has-children when the classification has children', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveChildren(true);

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'has-children' })
			);
			repository.assertDeleteHasNotBeenCalled();
		});

		it('should fail with in-use when transactions reference the classification', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldBeInUse(true);

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'in-use' })
			);
			repository.assertDeleteHasNotBeenCalled();
		});
	});
});
