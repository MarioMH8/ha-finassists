import type { Classification, ClassificationNode, ClassificationRepository } from '@modules/classifications/domain';
import { buildClassificationTree } from '@modules/classifications/domain';

import { assertBookExists } from './guards';

interface ListClassificationsOptions {
	includeArchived?: boolean;
}

class ListClassifications {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(bookId: string, options: ListClassificationsOptions = {}): Classification[] {
		assertBookExists(this.repository, bookId);

		return this.repository.list(bookId, options);
	}
}

class ListClassificationTree {
	constructor(private readonly repository: ClassificationRepository) {}

	execute(bookId: string, options: ListClassificationsOptions = {}): ClassificationNode[] {
		assertBookExists(this.repository, bookId);

		return buildClassificationTree(this.repository.list(bookId, options));
	}
}

export { ListClassifications, type ListClassificationsOptions, ListClassificationTree };
