class TransactionKindInvalidError extends Error {
	constructor() {
		super('kind must be expense or income');
	}
}

class TransactionAmountInvalidError extends Error {
	constructor() {
		super('amountMinor must be a positive safe integer');
	}
}

class TransactionDateFormatInvalidError extends Error {
	constructor() {
		super('transactionDate must use YYYY-MM-DD');
	}
}

class TransactionDateCalendarInvalidError extends Error {
	constructor() {
		super('transactionDate must be a valid calendar date');
	}
}

class TransactionDescriptionTooLongError extends Error {
	constructor(maxLength: number) {
		super(`description must be ${maxLength.toString()} characters or fewer`);
	}
}

export {
	TransactionAmountInvalidError,
	TransactionDateCalendarInvalidError,
	TransactionDateFormatInvalidError,
	TransactionDescriptionTooLongError,
	TransactionKindInvalidError,
};
