import type { ClassificationRepository } from '@modules/classifications/domain';
import { Classification } from '@modules/classifications/domain';

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
		if (input.name !== undefined) {
			Classification.normalizeName(this.repository.kind, input.name);
		}
		assertWritableBook(this.repository, bookId);
		const current = requireClassification(this.repository, bookId, id);

		let updated = input.name === undefined ? current : current.rename(input.name);
		if (input.parentId !== undefined && input.parentId !== current.parentId) {
			const parent =
				input.parentId === null ? undefined : requireActiveParent(this.repository, bookId, input.parentId);
			const isCycle = parent !== undefined && this.repository.isSelfOrDescendant(bookId, id, parent.id);
			updated = updated.reparent(parent, isCycle);
		}

		this.repository.save(updated);

		return updated;
	}
}

export { UpdateClassification, type UpdateClassificationInput };
