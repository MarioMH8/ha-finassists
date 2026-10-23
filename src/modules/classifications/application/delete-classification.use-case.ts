import type { ClassificationRepository } from '../domain';
import { ClassificationError, classificationLabels } from '../domain';
import { assertWritableBook, requireClassification } from './guards';

/**
 *Hard-deletes an unused leaf. In-use classifications must be archived; classifications with children must be emptied first.
 */
class DeleteClassification {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(bookId: string, id: string): void {
		const label = classificationLabels[this.repository.kind];
		assertWritableBook(this.repository, bookId);
		requireClassification(this.repository, bookId, id);
		if (this.repository.hasChildren(bookId, id)) {
			throw new ClassificationError(
				'has-children',
				`${label} ${id} has child ${label.toLowerCase()} entries and cannot be deleted`
			);
		}

		if (this.repository.isInUse(bookId, id)) {
			throw new ClassificationError('in-use', `${label} ${id} is used by transactions; archive it instead`);
		}

		this.repository.delete(bookId, id);
	}
}

export { DeleteClassification };
