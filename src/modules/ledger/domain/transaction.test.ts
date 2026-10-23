import { describe, expect, it } from 'bun:test';

import { FinancialTransaction, TRANSACTION_STATUS } from './transaction';
import {
	ReconciledTransactionBalanceChangeError,
	SplitTransactionPartsReplacementRequiredError,
	TransactionAmountInvalidError,
	TransactionDateCalendarInvalidError,
	TransactionDateFormatInvalidError,
	TransactionPartsSumMismatchError,
	TransferAccountsMustDifferError,
	TransferAmountDirectionInvalidError,
	TransferAmountInvalidError,
} from './transaction.error';

const JSON_NULL = JSON.parse('null') as null;

const TRANSACTION_PROPERTIES = {
	accountId: 'cash',
	actorId: JSON_NULL,
	amountMinor: -100,
	bookId: 'travel',
	id: 'transaction-1',
	memo: '',
	parts: [],
	payee: '',
	status: TRANSACTION_STATUS.UNCLEARED,
	transactionDate: '2026-03-01',
	transferId: JSON_NULL,
};

describe('FinancialTransaction', () => {
	it('creates an immutable transaction with immutable parts', () => {
		const transaction = FinancialTransaction.create({
			accountId: 'cash',
			actorId: JSON_NULL,
			amountMinor: -1250,
			bookId: 'travel',
			id: 'transaction-1',
			memo: 'Lunch',
			parts: [{ amountMinor: -1250, categoryId: JSON_NULL, classId: JSON_NULL, id: 'part-1', memo: 'Meal' }],
			payee: 'Cafe',
			status: TRANSACTION_STATUS.UNCLEARED,
			transactionDate: '2026-03-01',
			transferId: JSON_NULL,
		});

		expect(transaction).toBeInstanceOf(FinancialTransaction);
		expect(transaction).toMatchObject({ amountMinor: -1250, parts: [{ amountMinor: -1250, memo: 'Meal' }] });
		expect(Object.isFrozen(transaction)).toBe(true);
		expect(Object.isFrozen(transaction.parts)).toBe(true);
		expect(Object.isFrozen(transaction.parts[0])).toBe(true);
	});

	it('restores persisted transactions through the same invariants', () => {
		const restored = FinancialTransaction.restore(TRANSACTION_PROPERTIES);

		expect(restored).toBeInstanceOf(FinancialTransaction);
		expect(restored).toMatchObject({ id: 'transaction-1', status: 'uncleared', transactionDate: '2026-03-01' });
	});

	it('rejects invalid amounts, dates, and non-conserving parts with semantic errors', () => {
		expect(() =>
			FinancialTransaction.validateCreate({
				accountId: 'cash',
				amountMinor: Number.MAX_SAFE_INTEGER + 1,
				bookId: 'travel',
				transactionDate: '2026-03-01',
			})
		).toThrow(TransactionAmountInvalidError);
		expect(() =>
			FinancialTransaction.validateCreate({
				accountId: 'cash',
				amountMinor: -100,
				bookId: 'travel',
				transactionDate: '03/01/2026',
			})
		).toThrow(TransactionDateFormatInvalidError);
		expect(() =>
			FinancialTransaction.validateCreate({
				accountId: 'cash',
				amountMinor: -100,
				bookId: 'travel',
				transactionDate: '2026-02-30',
			})
		).toThrow(TransactionDateCalendarInvalidError);
		expect(() =>
			FinancialTransaction.validateCreate({
				accountId: 'cash',
				amountMinor: -100,
				bookId: 'travel',
				parts: [{ amountMinor: -99 }],
				transactionDate: '2026-03-01',
			})
		).toThrow(TransactionPartsSumMismatchError);
	});

	it('rejects invalid transfer amounts and same-account transfers', () => {
		const input = {
			amountMinor: 0,
			bookId: 'travel',
			fromAccountId: 'cash',
			toAccountId: 'savings',
			transactionDate: '2026-03-01',
		};
		expect(() => FinancialTransaction.validateTransfer(input)).toThrow(TransferAmountInvalidError);
		expect(() =>
			FinancialTransaction.validateTransfer({ ...input, amountMinor: 100, toAccountId: 'cash' })
		).toThrow(TransferAccountsMustDifferError);
	});

	it('keeps reconciled balance-affecting changes and incomplete split amount changes invalid', () => {
		const reconciled = FinancialTransaction.restore({
			...TRANSACTION_PROPERTIES,
			status: TRANSACTION_STATUS.RECONCILED,
		});
		const split = FinancialTransaction.restore({
			...TRANSACTION_PROPERTIES,
			parts: [
				{ amountMinor: -40, categoryId: JSON_NULL, classId: JSON_NULL, id: 'part-1', memo: '' },
				{ amountMinor: -60, categoryId: JSON_NULL, classId: JSON_NULL, id: 'part-2', memo: '' },
			],
		});

		expect(() => reconciled.update({ transactionDate: '2026-03-02' })).toThrow(
			ReconciledTransactionBalanceChangeError
		);
		expect(() => split.update({ amountMinor: -120 })).toThrow(SplitTransactionPartsReplacementRequiredError);
	});

	it('preserves transfer leg direction during updates', () => {
		const transfer = FinancialTransaction.restore({ ...TRANSACTION_PROPERTIES, transferId: 'transfer-1' });

		expect(() => transfer.update({ amountMinor: 100 })).toThrow(TransferAmountDirectionInvalidError);
	});
});
