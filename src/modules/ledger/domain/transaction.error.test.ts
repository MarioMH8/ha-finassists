import { describe, expect, it } from 'bun:test';

import {
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
} from './transaction.error';

const ERRORS: [string, Error][] = [
	['ReconciledTransactionBalanceChangeError', new ReconciledTransactionBalanceChangeError()],
	['SplitTransactionPartsReplacementRequiredError', new SplitTransactionPartsReplacementRequiredError()],
	['TransactionAmountInvalidError', new TransactionAmountInvalidError()],
	['TransactionDateCalendarInvalidError', new TransactionDateCalendarInvalidError()],
	['TransactionDateFormatInvalidError', new TransactionDateFormatInvalidError()],
	['TransactionMemoLengthInvalidError', new TransactionMemoLengthInvalidError()],
	['TransactionPartMemoLengthInvalidError', new TransactionPartMemoLengthInvalidError()],
	['TransactionPartsSumMismatchError', new TransactionPartsSumMismatchError()],
	['TransactionPayeeLengthInvalidError', new TransactionPayeeLengthInvalidError()],
	['TransactionStatusInvalidError', new TransactionStatusInvalidError()],
	['TransferAccountsMustDifferError', new TransferAccountsMustDifferError()],
	['TransferAmountDirectionInvalidError', new TransferAmountDirectionInvalidError()],
	['TransferAmountInvalidError', new TransferAmountInvalidError()],
	['TransferFieldsCannotChangeIndependentlyError', new TransferFieldsCannotChangeIndependentlyError()],
	['TransferPeerReconciliationError', new TransferPeerReconciliationError()],
];

describe('transaction errors', () => {
	it.each(ERRORS)('should expose %s with its name and a message', (name, error) => {
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe(name);
		expect(error.message).not.toBe('');
	});
});
