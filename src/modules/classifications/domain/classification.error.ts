const CLASSIFICATION_ERROR_CODE = {
	BOOK_ARCHIVED: 'book-archived',
	BOOK_NOT_FOUND: 'book-not-found',
	CYCLE: 'cycle',
	HAS_CHILDREN: 'has-children',
	IN_USE: 'in-use',
	INVALID_BOOK_ID: 'invalid-book-id',
	INVALID_ID: 'invalid-id',
	INVALID_NAME: 'invalid-name',
	NOT_FOUND: 'not-found',
	PARENT_ARCHIVED: 'parent-archived',
	PARENT_NOT_FOUND: 'parent-not-found',
} as const;

type ClassificationErrorCode = (typeof CLASSIFICATION_ERROR_CODE)[keyof typeof CLASSIFICATION_ERROR_CODE];

class ClassificationError extends Error {
	constructor(
		readonly code: ClassificationErrorCode,
		message: string
	) {
		super(message);
		this.name = 'ClassificationError';
	}
}

export { CLASSIFICATION_ERROR_CODE, ClassificationError, type ClassificationErrorCode };
