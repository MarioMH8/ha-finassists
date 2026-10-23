class BudgetAccountNotFoundError extends Error {
	constructor() {
		super('Account not found in this book');
		this.name = 'BudgetAccountNotFoundError';
	}
}

class BudgetActualAmountInvalidError extends Error {
	constructor() {
		super('Budget actual amount must be a non-negative safe integer');
		this.name = 'BudgetActualAmountInvalidError';
	}
}

class BudgetAmountOutOfRangeError extends Error {
	constructor(amount: string) {
		super(`Budget ${amount} amount exceeds the safe integer range`);
		this.name = 'BudgetAmountOutOfRangeError';
	}
}

class BudgetBookArchivedError extends Error {
	constructor() {
		super('Cannot create budgets in an archived book');
		this.name = 'BudgetBookArchivedError';
	}
}

class BudgetBookNotFoundError extends Error {
	constructor() {
		super('Book not found');
		this.name = 'BudgetBookNotFoundError';
	}
}

class BudgetCategoryArchivedError extends Error {
	constructor() {
		super('Cannot create a budget for an archived category');
		this.name = 'BudgetCategoryArchivedError';
	}
}

class BudgetCategoryNotFoundError extends Error {
	constructor() {
		super('Category not found in this book');
		this.name = 'BudgetCategoryNotFoundError';
	}
}

class BudgetClassArchivedError extends Error {
	constructor() {
		super('Cannot create a budget for an archived class');
		this.name = 'BudgetClassArchivedError';
	}
}

class BudgetClassNotFoundError extends Error {
	constructor() {
		super('Class not found in this book');
		this.name = 'BudgetClassNotFoundError';
	}
}

class BudgetDateInvalidError extends Error {
	constructor(label: string, reason: string) {
		super(`${label} ${reason}`);
		this.name = 'BudgetDateInvalidError';
	}
}

class BudgetIdentifierInvalidError extends Error {
	constructor(label: string) {
		super(`${label} must not be empty`);
		this.name = 'BudgetIdentifierInvalidError';
	}
}

class BudgetIdentityConflictError extends Error {
	constructor() {
		super('A budget with this id already exists in another book');
		this.name = 'BudgetIdentityConflictError';
	}
}

class BudgetNameInvalidError extends Error {
	constructor() {
		super('Budget name must contain between 1 and 80 characters');
		this.name = 'BudgetNameInvalidError';
	}
}

class BudgetNotFoundError extends Error {
	constructor() {
		super('Budget not found');
		this.name = 'BudgetNotFoundError';
	}
}

class BudgetPeriodInvalidError extends Error {
	constructor() {
		super('Budget start date must be on or before its end date');
		this.name = 'BudgetPeriodInvalidError';
	}
}

class BudgetPeriodOverlapError extends Error {
	constructor() {
		super('Budget periods cannot overlap for the same account and scope');
		this.name = 'BudgetPeriodOverlapError';
	}
}

class BudgetPlannedAmountInvalidError extends Error {
	constructor(reason: string) {
		super(`Budget planned amount ${reason}`);
		this.name = 'BudgetPlannedAmountInvalidError';
	}
}

export {
	BudgetAccountNotFoundError,
	BudgetActualAmountInvalidError,
	BudgetAmountOutOfRangeError,
	BudgetBookArchivedError,
	BudgetBookNotFoundError,
	BudgetCategoryArchivedError,
	BudgetCategoryNotFoundError,
	BudgetClassArchivedError,
	BudgetClassNotFoundError,
	BudgetDateInvalidError,
	BudgetIdentifierInvalidError,
	BudgetIdentityConflictError,
	BudgetNameInvalidError,
	BudgetNotFoundError,
	BudgetPeriodInvalidError,
	BudgetPeriodOverlapError,
	BudgetPlannedAmountInvalidError,
};
