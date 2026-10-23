import type { Classification, ClassificationRepository } from '../domain';
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
		if (current.archivedAt !== null) {
			return current;
		}

		this.repository.archiveSubtree(bookId, id, new Date().toISOString());

		return requireClassification(this.repository, bookId, id);
	}
}

export { ArchiveClassification };
