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
} from './transaction.error';

const TRANSACTION_STATUS = {
	CLEARED: 'cleared',
	RECONCILED: 'reconciled',
	UNCLEARED: 'uncleared',
} as const;

const TRANSACTION_STATUSES = Object.values(TRANSACTION_STATUS);
const JSON_NULL = JSON.parse('null') as null;

type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

interface TransactionPartInput {
	amountMinor: number;
	categoryId?: null | string;
	classId?: null | string;
	memo?: string;
}

interface TransactionPart extends TransactionPartInput {
	categoryId: null | string;
	classId: null | string;
	id: string;
	memo: string;
}

interface FinancialTransactionProperties {
	accountId: string;
	actorId: null | string;
	amountMinor: number;
	bookId: string;
	id: string;
	memo: string;
	parts: readonly TransactionPart[];
	payee: string;
	status: TransactionStatus;
	transactionDate: string;
	transferId: null | string;
}

interface CreateTransactionInput {
	accountId: string;
	actorId?: null | string;
	amountMinor: number;
	bookId: string;
	memo?: string;
	parts?: TransactionPartInput[];
	payee?: string;
	transactionDate: string;
}

interface CreateTransferInput {
	actorId?: null | string;
	amountMinor: number;
	bookId: string;
	fromAccountId: string;
	memo?: string;
	toAccountId: string;
	transactionDate: string;
}

interface UpdateTransactionInput {
	accountId?: string;
	amountMinor?: number;
	memo?: string;
	parts?: TransactionPartInput[];
	payee?: string;
	transactionDate?: string;
}

interface LedgerRepository {
	create(input: CreateTransactionInput): FinancialTransaction;
	createTransfer(input: CreateTransferInput): { from: FinancialTransaction; id: string; to: FinancialTransaction };
	find(bookId: string, id: string): FinancialTransaction | undefined;
	list(bookId: string, accountId: string): FinancialTransaction[];
	remove(bookId: string, id: string): boolean;
	setStatus(bookId: string, id: string, status: TransactionStatus): boolean;
	update(bookId: string, id: string, input: UpdateTransactionInput): FinancialTransaction | undefined;
}

class FinancialTransaction {
	readonly accountId: string;
	readonly actorId: null | string;
	readonly amountMinor: number;
	readonly bookId: string;
	readonly id: string;
	readonly memo: string;
	readonly parts: readonly TransactionPart[];
	readonly payee: string;
	readonly status: TransactionStatus;
	readonly transactionDate: string;
	readonly transferId: null | string;

	private constructor(properties: FinancialTransactionProperties) {
		this.accountId = properties.accountId;
		this.actorId = properties.actorId;
		this.amountMinor = properties.amountMinor;
		this.bookId = properties.bookId;
		this.id = properties.id;
		this.memo = properties.memo;
		this.parts = Object.freeze(properties.parts.map(part => Object.freeze({ ...part })));
		this.payee = properties.payee;
		this.status = properties.status;
		this.transactionDate = properties.transactionDate;
		this.transferId = properties.transferId;
		Object.freeze(this);
	}

	static create(properties: FinancialTransactionProperties): FinancialTransaction {
		this.validateCreate({
			accountId: properties.accountId,
			actorId: properties.actorId,
			amountMinor: properties.amountMinor,
			bookId: properties.bookId,
			memo: properties.memo,
			parts: [...properties.parts],
			payee: properties.payee,
			transactionDate: properties.transactionDate,
		});
		if (!TRANSACTION_STATUSES.includes(properties.status)) {
			throw new TransactionStatusInvalidError();
		}

		return new this({ ...properties });
	}

	static restore(properties: FinancialTransactionProperties): FinancialTransaction {
		return this.create(properties);
	}

	static validateCreate(input: CreateTransactionInput): void {
		this.assertSafeMinorUnits(input.amountMinor);
		this.validateDate(input.transactionDate);
		if (input.payee !== undefined && input.payee.length > 120) {
			throw new TransactionPayeeLengthInvalidError();
		}
		if (input.memo !== undefined && input.memo.length > 500) {
			throw new TransactionMemoLengthInvalidError();
		}

		const parts = input.parts ?? [];
		let sum = 0n;
		for (const part of parts) {
			this.assertSafeMinorUnits(part.amountMinor);
			if (part.memo !== undefined && part.memo.length > 500) {
				throw new TransactionPartMemoLengthInvalidError();
			}
			sum += BigInt(part.amountMinor);
		}
		if (parts.length > 0 && sum !== BigInt(input.amountMinor)) {
			throw new TransactionPartsSumMismatchError();
		}
	}

	static validateDate(value: string): void {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			throw new TransactionDateFormatInvalidError();
		}
		const date = new Date(`${value}T00:00:00.000Z`);
		if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
			throw new TransactionDateCalendarInvalidError();
		}
	}

	static validateTransfer(input: CreateTransferInput): void {
		this.assertSafeMinorUnits(input.amountMinor);
		this.validateDate(input.transactionDate);
		if (input.amountMinor <= 0) {
			throw new TransferAmountInvalidError();
		}
		if (input.fromAccountId === input.toAccountId) {
			throw new TransferAccountsMustDifferError();
		}
		if (input.memo !== undefined && input.memo.length > 500) {
			throw new TransactionMemoLengthInvalidError();
		}
	}

	private static assertSafeMinorUnits(amountMinor: number): void {
		if (!Number.isSafeInteger(amountMinor)) {
			throw new TransactionAmountInvalidError();
		}
	}

	update(input: UpdateTransactionInput): UpdateTransactionInput {
		if (this.status === TRANSACTION_STATUS.RECONCILED && this.changesBalanceAffectingFields(input)) {
			throw new ReconciledTransactionBalanceChangeError();
		}
		if (this.transferId !== null && (input.accountId !== undefined || input.parts !== undefined)) {
			throw new TransferFieldsCannotChangeIndependentlyError();
		}
		if (this.transferId !== null && input.amountMinor === 0) {
			throw new TransferAmountInvalidError();
		}
		if (input.payee !== undefined && input.payee.length > 120) {
			throw new TransactionPayeeLengthInvalidError();
		}
		if (input.memo !== undefined && input.memo.length > 500) {
			throw new TransactionMemoLengthInvalidError();
		}

		let parts = input.parts;
		if (parts === undefined && input.amountMinor !== undefined && this.parts.length > 1) {
			throw new SplitTransactionPartsReplacementRequiredError();
		}
		if (parts === undefined && input.amountMinor !== undefined && this.parts.length === 1) {
			parts = [{ ...this.parts[0], amountMinor: input.amountMinor }];
		}

		FinancialTransaction.validateCreate({
			accountId: input.accountId ?? this.accountId,
			actorId: this.actorId,
			amountMinor: input.amountMinor ?? this.amountMinor,
			bookId: this.bookId,
			memo: input.memo ?? this.memo,
			parts: parts ?? [...this.parts],
			payee: input.payee ?? this.payee,
			transactionDate: input.transactionDate ?? this.transactionDate,
		});
		if (
			this.transferId !== null &&
			input.amountMinor !== undefined &&
			Math.sign(input.amountMinor) !== Math.sign(this.amountMinor)
		) {
			throw new TransferAmountDirectionInvalidError();
		}

		return parts === undefined ? { ...input } : { ...input, parts };
	}

	private changesBalanceAffectingFields(input: UpdateTransactionInput): boolean {
		return (
			(input.accountId !== undefined && input.accountId !== this.accountId) ||
			(input.amountMinor !== undefined && input.amountMinor !== this.amountMinor) ||
			(input.transactionDate !== undefined && input.transactionDate !== this.transactionDate) ||
			(input.parts !== undefined &&
				(input.parts.length !== this.parts.length ||
					input.parts.some((part, index) => {
						const current = this.parts[index];

						return (
							part.amountMinor !== current.amountMinor ||
							(part.categoryId ?? JSON_NULL) !== current.categoryId ||
							(part.classId ?? JSON_NULL) !== current.classId ||
							(part.memo ?? '') !== current.memo
						);
					})))
		);
	}
}

export {
	type CreateTransactionInput,
	type CreateTransferInput,
	FinancialTransaction,
	type FinancialTransactionProperties,
	type LedgerRepository,
	TRANSACTION_STATUS,
	type TransactionPart,
	type TransactionPartInput,
	type TransactionStatus,
	type UpdateTransactionInput,
};
