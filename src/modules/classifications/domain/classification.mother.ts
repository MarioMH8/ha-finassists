import type { ClassificationInput, ClassificationKind } from './classification';
import { Classification } from './classification';

class ClassificationMother {
	static create(overrides: Partial<ClassificationInput> = {}, kind: ClassificationKind = 'category'): Classification {
		return Classification.reconstitute(kind, {
			bookId: 'book-1',
			id: 'classification-1',
			name: 'Groceries',
			...overrides,
		});
	}
}

export { ClassificationMother };
