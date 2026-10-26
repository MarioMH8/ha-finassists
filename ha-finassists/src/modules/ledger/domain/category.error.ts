class CategoryNameInvalidError extends Error {
	constructor() {
		super('name is required');
	}
}

class CategoryNameTooLongError extends Error {
	constructor(maxLength: number) {
		super(`name must be ${maxLength.toString()} characters or fewer`);
	}
}

class CategoryKindInvalidError extends Error {
	constructor() {
		super('kind must be expense or income');
	}
}

class CategoryNameAlreadyExistsError extends Error {
	constructor(name: string) {
		super(`category "${name}" already exists`);
	}
}

class CategoryNotFoundError extends Error {
	constructor(id: string) {
		super(`category ${id} not found`);
	}
}

class CategoryKindMismatchError extends Error {
	constructor(kind: string) {
		super(`category kind must match the transaction kind, which is ${kind}`);
	}
}

class CategoryInUseError extends Error {
	constructor(id: string, transactionCount: number) {
		super(`category ${id} cannot be changed or deleted while ${transactionCount.toString()} transactions use it`);
	}
}

export {
	CategoryInUseError,
	CategoryKindInvalidError,
	CategoryKindMismatchError,
	CategoryNameAlreadyExistsError,
	CategoryNameInvalidError,
	CategoryNameTooLongError,
	CategoryNotFoundError,
};
