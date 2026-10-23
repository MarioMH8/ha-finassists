import { randomUUID } from 'node:crypto';

import type { Classification, ClassificationRepository } from '../domain';
import { createClassification } from '../domain';
import { assertWritableBook, requireActiveParent } from './guards';

interface CreateClassificationInput {
	bookId: string;
	name: string;
	parentId?: null | string;
}

class CreateClassification {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(input: CreateClassificationInput): Classification {
		const classification = createClassification(this.repository.kind, { ...input, id: randomUUID() });
		assertWritableBook(this.repository, input.bookId);
		if (classification.parentId !== null) {
			requireActiveParent(this.repository, input.bookId, classification.parentId);
		}

		this.repository.create(classification);

		return classification;
	}
}

export { CreateClassification, type CreateClassificationInput };
