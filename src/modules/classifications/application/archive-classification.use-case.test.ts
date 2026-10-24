import { ClassificationMother } from '@modules/classifications/domain/classification.mother';
import { MockClassificationRepository } from '@modules/classifications/infrastructure/repositories/mock-classification.repository';
import { afterEach, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';

import { ArchiveClassification } from './archive-classification.use-case';

const NOW = '2026-02-01T00:00:00.000Z';

function createUseCase() {
	const repository = new MockClassificationRepository('category');
	repository.shouldHaveBookState('active');

	return { repository, useCase: new ArchiveClassification(repository) };
}

describe('ArchiveClassification', () => {
	beforeEach(() => {
		setSystemTime(new Date(NOW));
	});

	afterEach(() => {
		setSystemTime();
	});

	describe('execute', () => {
		it('should archive the subtree and return the reloaded classification', () => {
			const { repository, useCase } = createUseCase();
			const active = ClassificationMother.create();
			const archived = active.archive(NOW);
			repository.shouldFindInOrder(active, archived);

			const result = useCase.execute('book-1', 'classification-1');

			expect(result).toBe(archived);
			repository.assertArchiveSubtreeHasBeenCalledWith('book-1', 'classification-1', NOW);
		});

		it('should return an already archived classification without archiving again', () => {
			const { repository, useCase } = createUseCase();
			const archived = ClassificationMother.create({ archivedAt: '2026-01-01T00:00:00.000Z' });
			repository.shouldFind(archived);

			expect(useCase.execute('book-1', 'classification-1')).toBe(archived);
			repository.assertArchiveSubtreeHasNotBeenCalled();
		});

		it('should fail with book-not-found when the book does not exist', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState(undefined);

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'book-not-found' })
			);
			repository.assertArchiveSubtreeHasNotBeenCalled();
		});

		it('should fail with book-archived when the book is archived', () => {
			const { repository, useCase } = createUseCase();
			repository.shouldHaveBookState('archived');

			expect(() => useCase.execute('book-1', 'classification-1')).toThrow(
				expect.objectContaining({ code: 'book-archived' })
			);
			repository.assertArchiveSubtreeHasNotBeenCalled();
		});

		it('should fail with not-found when the classification does not exist', () => {
			const { repository, useCase } = createUseCase();

			expect(() => useCase.execute('book-1', 'missing')).toThrow(expect.objectContaining({ code: 'not-found' }));
			repository.assertArchiveSubtreeHasNotBeenCalled();
		});
	});
});
