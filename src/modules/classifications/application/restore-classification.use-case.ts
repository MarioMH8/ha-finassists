import type { Classification, ClassificationRepository } from '../domain';
import { assertWritableBook, requireActiveParent, requireClassification } from './guards';

/**
 *Restores one archived classification; its parent must be active. Descendants stay archived.
 */
class RestoreClassification {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(bookId: string, id: string): Classification {
		assertWritableBook(this.repository, bookId);
		const current = requireClassification(this.repository, bookId, id);
		if (current.archivedAt === null) {
			return current;
		}

		const parent =
			current.parentId === null ? undefined : requireActiveParent(this.repository, bookId, current.parentId);
		const restored: Classification = current.restore(parent);
		this.repository.save(restored);

		return restored;
	}
}

export { RestoreClassification };
