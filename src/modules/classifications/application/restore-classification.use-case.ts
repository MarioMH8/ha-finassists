import type { Classification, ClassificationRepository } from '../domain';
import { assertWritableBook, requireActiveParent, requireClassification } from './guards';

const JSON_NULL = JSON.parse('null') as null;

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

		if (current.parentId !== null) {
			requireActiveParent(this.repository, bookId, current.parentId);
		}

		const restored: Classification = { ...current, archivedAt: JSON_NULL };
		this.repository.save(restored);

		return restored;
	}
}

export { RestoreClassification };
