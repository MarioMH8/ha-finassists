type ClassificationErrorCode =
	| 'book-archived'
	| 'book-not-found'
	| 'cycle'
	| 'has-children'
	| 'in-use'
	| 'not-found'
	| 'parent-archived'
	| 'parent-not-found';

class ClassificationError extends Error {
	constructor(
		readonly code: ClassificationErrorCode,
		message: string
	) {
		super(message);
		this.name = 'ClassificationError';
	}
}

export { ClassificationError, type ClassificationErrorCode };
