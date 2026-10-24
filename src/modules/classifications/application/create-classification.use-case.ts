import { randomUUID } from 'node:crypto';

import type { ClassificationRepository } from '@modules/classifications/domain';
import { Classification } from '@modules/classifications/domain';

import { assertWritableBook, requireActiveParent } from './guards';

interface CreateClassificationInput {
	bookId: string;
	name: string;
	parentId?: null | string;
}

class CreateClassification {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(input: CreateClassificationInput): Classification {
		let classification = Classification.create(this.repository.kind, { ...input, id: randomUUID() });
		assertWritableBook(this.repository, input.bookId);
		if (input.parentId !== undefined && input.parentId !== null) {
			const parent = requireActiveParent(this.repository, input.bookId, input.parentId);
			classification = classification.reparent(parent, false);
		}

		this.repository.create(classification);

		return classification;
	}
}

export { CreateClassification, type CreateClassificationInput };
