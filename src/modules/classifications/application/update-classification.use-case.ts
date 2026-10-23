import type { Classification, ClassificationRepository } from '../domain';
import { ClassificationError, classificationLabels, normalizeClassificationName } from '../domain';
import { assertWritableBook, requireActiveParent, requireClassification } from './guards';

interface UpdateClassificationInput {
	name?: string;
	/**
	 *`null` moves the classification to the root; `undefined` keeps the current parent.
	 */
	parentId?: null | string;
}

/**
 *Renames and/or reparents a classification, rejecting moves that would create a cycle.
 */
class UpdateClassification {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(bookId: string, id: string, input: UpdateClassificationInput): Classification {
		const { kind } = this.repository;
		const name = input.name === undefined ? undefined : normalizeClassificationName(kind, input.name);
		assertWritableBook(this.repository, bookId);
		const current = requireClassification(this.repository, bookId, id);

		let parentId = current.parentId;
		if (input.parentId !== undefined && input.parentId !== current.parentId) {
			parentId = input.parentId;
			if (parentId !== null) {
				requireActiveParent(this.repository, bookId, parentId);
				if (this.repository.isSelfOrDescendant(bookId, id, parentId)) {
					throw new ClassificationError(
						'cycle',
						`${classificationLabels[kind]} ${id} cannot be moved below itself or one of its descendants`
					);
				}
			}
		}

		const updated: Classification = { ...current, name: name ?? current.name, parentId };
		this.repository.save(updated);

		return updated;
	}
}

export { UpdateClassification, type UpdateClassificationInput };
