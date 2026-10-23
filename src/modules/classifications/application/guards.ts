import type { Classification, ClassificationRepository } from '../domain';
import { ClassificationError, classificationLabels } from '../domain';

function assertBookExists(repository: ClassificationRepository, bookId: string): 'active' | 'archived' {
	const state = repository.bookState(bookId);
	if (state === undefined) {
		throw new ClassificationError('book-not-found', `Book ${bookId} was not found`);
	}

	return state;
}

function assertWritableBook(repository: ClassificationRepository, bookId: string): void {
	if (assertBookExists(repository, bookId) === 'archived') {
		throw new ClassificationError('book-archived', `Book ${bookId} is archived`);
	}
}

function requireClassification(repository: ClassificationRepository, bookId: string, id: string): Classification {
	const classification = repository.find(bookId, id);
	if (!classification) {
		throw new ClassificationError(
			'not-found',
			`${classificationLabels[repository.kind]} ${id} was not found in book ${bookId}`
		);
	}

	return classification;
}

function requireActiveParent(repository: ClassificationRepository, bookId: string, parentId: string): Classification {
	const label = classificationLabels[repository.kind];
	const parent = repository.find(bookId, parentId);
	if (!parent) {
		throw new ClassificationError(
			'parent-not-found',
			`Parent ${label.toLowerCase()} ${parentId} was not found in book ${bookId}`
		);
	}

	if (parent.archivedAt !== null) {
		throw new ClassificationError('parent-archived', `Parent ${label.toLowerCase()} ${parentId} is archived`);
	}

	return parent;
}

export { assertBookExists, assertWritableBook, requireActiveParent, requireClassification };
