class AccountAsOfDateInvalidError extends Error {
	constructor() {
		super('Account as-of date must be a valid YYYY-MM-DD date');
		this.name = 'AccountAsOfDateInvalidError';
	}
}

class AccountAlreadyClosedError extends Error {
	constructor(id: string) {
		super(`Account ${id} is already closed`);
		this.name = 'AccountAlreadyClosedError';
	}
}

class AccountBalanceOutOfRangeError extends Error {
	constructor(id: string) {
		super(`Account ${id} balance exceeds the safe integer range`);
		this.name = 'AccountBalanceOutOfRangeError';
	}
}

class AccountBookArchivedError extends Error {
	constructor() {
		super('Cannot create accounts in an archived book');
		this.name = 'AccountBookArchivedError';
	}
}

class AccountBookNotFoundError extends Error {
	constructor() {
		super('Book not found');
		this.name = 'AccountBookNotFoundError';
	}
}

class AccountBookIdInvalidError extends Error {
	constructor() {
		super('Account book id must not be empty');
		this.name = 'AccountBookIdInvalidError';
	}
}

class AccountIdInvalidError extends Error {
	constructor() {
		super('Account id must not be empty');
		this.name = 'AccountIdInvalidError';
	}
}

class AccountIdentityConflictError extends Error {
	constructor() {
		super('Account id already belongs to a different book');
		this.name = 'AccountIdentityConflictError';
	}
}

class AccountKindInvalidError extends Error {
	constructor(kinds: readonly string[]) {
		super(`Account kind must be one of: ${kinds.join(', ')}`);
		this.name = 'AccountKindInvalidError';
	}
}

class AccountNameInvalidError extends Error {
	constructor() {
		super('Account name must contain between 1 and 80 characters');
		this.name = 'AccountNameInvalidError';
	}
}

class AccountNotFoundError extends Error {
	constructor() {
		super('Account not found');
		this.name = 'AccountNotFoundError';
	}
}

class AccountNotClosedError extends Error {
	constructor(id: string) {
		super(`Account ${id} is not closed`);
		this.name = 'AccountNotClosedError';
	}
}

class AccountOpeningBalanceInvalidError extends Error {
	constructor() {
		super('Account opening balance must be a safe integer');
		this.name = 'AccountOpeningBalanceInvalidError';
	}
}

export {
	AccountAlreadyClosedError,
	AccountAsOfDateInvalidError,
	AccountBalanceOutOfRangeError,
	AccountBookArchivedError,
	AccountBookIdInvalidError,
	AccountBookNotFoundError,
	AccountIdentityConflictError,
	AccountIdInvalidError,
	AccountKindInvalidError,
	AccountNameInvalidError,
	AccountNotClosedError,
	AccountNotFoundError,
	AccountOpeningBalanceInvalidError,
};
