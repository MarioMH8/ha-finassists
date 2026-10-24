import type { Classification, ClassificationRepository } from '@modules/classifications/domain';

import { assertWritableBook, requireClassification } from './guards';

/**
 * Archives a classification and its whole subtree. Archiving is always allowed,
 * including for classifications referenced by transactions, which keep their reference.
 */
class ArchiveClassification {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(bookId: string, id: string): Classification {
		assertWritableBook(this.repository, bookId);
		const current = requireClassification(this.repository, bookId, id);
		const archivedAt = new Date().toISOString();
		if (current.archive(archivedAt) === current) {
			return current;
		}

		this.repository.archiveSubtree(bookId, id, archivedAt);

		return requireClassification(this.repository, bookId, id);
	}
}

export { ArchiveClassification };
