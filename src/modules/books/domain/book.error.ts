class BookAlreadyArchivedError extends Error {
	constructor(id: string) {
		super(`Book ${id} is already archived`);
		this.name = 'BookAlreadyArchivedError';
	}
}

class BookIdInvalidError extends Error {
	constructor() {
		super('Book id must not be empty');
		this.name = 'BookIdInvalidError';
	}
}

class BookNameInvalidError extends Error {
	constructor() {
		super('Book name must contain between 1 and 80 characters');
		this.name = 'BookNameInvalidError';
	}
}

export { BookAlreadyArchivedError, BookIdInvalidError, BookNameInvalidError };
