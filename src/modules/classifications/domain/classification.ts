const JSON_NULL = JSON.parse('null') as null;

type ClassificationKind = 'category' | 'class';

interface Classification {
	archivedAt: null | string;
	bookId: string;
	id: string;
	name: string;
	parentId: null | string;
}

interface ClassificationInput {
	archivedAt?: null | string;
	bookId: string;
	id: string;
	name: string;
	parentId?: null | string;
}

const classificationLabels: Record<ClassificationKind, string> = {
	category: 'Category',
	class: 'Class',
};

const classificationNameMaxLength = 80;

function normalizeClassificationName(kind: ClassificationKind, name: string): string {
	const normalized = name.trim();
	// Code points, not UTF-16 units, to match the SQLite length() CHECK
	// eslint-disable-next-line typescript/no-misused-spread
	const length = [...normalized].length;
	if (length < 1 || length > classificationNameMaxLength) {
		throw new RangeError(
			`${classificationLabels[kind]} name must contain between 1 and ${String(classificationNameMaxLength)} characters`
		);
	}

	return normalized;
}

function createClassification(kind: ClassificationKind, input: ClassificationInput): Classification {
	if (input.id.trim().length === 0) {
		throw new Error(`${classificationLabels[kind]} id must not be empty`);
	}

	if (input.bookId.trim().length === 0) {
		throw new Error(`${classificationLabels[kind]} book id must not be empty`);
	}

	return {
		archivedAt: input.archivedAt ?? JSON_NULL,
		bookId: input.bookId,
		id: input.id,
		name: normalizeClassificationName(kind, input.name),
		parentId: input.parentId ?? JSON_NULL,
	};
}

export {
	type Classification,
	type ClassificationInput,
	type ClassificationKind,
	classificationLabels,
	classificationNameMaxLength,
	createClassification,
	normalizeClassificationName,
};
