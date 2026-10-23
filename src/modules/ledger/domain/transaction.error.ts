class TransactionAmountInvalidError extends Error {
	constructor() {
		super('Money minor units must be a safe integer');
		this.name = 'TransactionAmountInvalidError';
	}
}

class TransactionDateFormatInvalidError extends Error {
	constructor() {
		super('Transaction date must use YYYY-MM-DD format');
		this.name = 'TransactionDateFormatInvalidError';
	}
}

class TransactionDateCalendarInvalidError extends Error {
	constructor() {
		super('Transaction date must be a valid calendar date');
		this.name = 'TransactionDateCalendarInvalidError';
	}
}

class TransactionPayeeLengthInvalidError extends Error {
	constructor() {
		super('Payee must be at most 120 characters');
		this.name = 'TransactionPayeeLengthInvalidError';
	}
}

class TransactionMemoLengthInvalidError extends Error {
	constructor() {
		super('Memo must be at most 500 characters');
		this.name = 'TransactionMemoLengthInvalidError';
	}
}

class TransactionPartMemoLengthInvalidError extends Error {
	constructor() {
		super('Transaction part memo must be at most 500 characters');
		this.name = 'TransactionPartMemoLengthInvalidError';
	}
}

class TransactionPartsSumMismatchError extends Error {
	constructor() {
		super('Transaction parts must sum to the transaction amount');
		this.name = 'TransactionPartsSumMismatchError';
	}
}

class TransactionStatusInvalidError extends Error {
	constructor() {
		super('Transaction status is invalid');
		this.name = 'TransactionStatusInvalidError';
	}
}

class TransferAmountInvalidError extends Error {
	constructor() {
		super('Transfer amount must be greater than zero');
		this.name = 'TransferAmountInvalidError';
	}
}

class TransferAccountsMustDifferError extends Error {
	constructor() {
		super('Transfer accounts must be different');
		this.name = 'TransferAccountsMustDifferError';
	}
}

class ReconciledTransactionBalanceChangeError extends Error {
	constructor() {
		super('Reconciled transactions must be unreconciled before changing their date, account, amount, or splits');
		this.name = 'ReconciledTransactionBalanceChangeError';
	}
}

class TransferFieldsCannotChangeIndependentlyError extends Error {
	constructor() {
		super('Transfer accounts and splits cannot be changed independently');
		this.name = 'TransferFieldsCannotChangeIndependentlyError';
	}
}

class SplitTransactionPartsReplacementRequiredError extends Error {
	constructor() {
		super('Split transaction amount changes require a complete replacement of its parts');
		this.name = 'SplitTransactionPartsReplacementRequiredError';
	}
}

class TransferPeerReconciliationError extends Error {
	constructor() {
		super('The reconciled transfer leg must be unreconciled before changing the transfer amount or date');
		this.name = 'TransferPeerReconciliationError';
	}
}

class TransferAmountDirectionInvalidError extends Error {
	constructor() {
		super('Transfer amount must retain the leg direction and remain greater than zero');
		this.name = 'TransferAmountDirectionInvalidError';
	}
}

export {
	ReconciledTransactionBalanceChangeError,
	SplitTransactionPartsReplacementRequiredError,
	TransactionAmountInvalidError,
	TransactionDateCalendarInvalidError,
	TransactionDateFormatInvalidError,
	TransactionMemoLengthInvalidError,
	TransactionPartMemoLengthInvalidError,
	TransactionPartsSumMismatchError,
	TransactionPayeeLengthInvalidError,
	TransactionStatusInvalidError,
	TransferAccountsMustDifferError,
	TransferAmountDirectionInvalidError,
	TransferAmountInvalidError,
	TransferFieldsCannotChangeIndependentlyError,
	TransferPeerReconciliationError,
};
