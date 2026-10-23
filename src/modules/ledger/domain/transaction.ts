const TRANSACTION_STATUS = {
	CLEARED: 'cleared',
	RECONCILED: 'reconciled',
	UNCLEARED: 'uncleared',
} as const;

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

interface FinancialTransaction {
	accountId: string;
	actorId: null | string;
	amountMinor: number;
	bookId: string;
	id: string;
	memo: string;
	parts: TransactionPart[];
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

function assertSafeMinorUnits(amountMinor: number): void {
	if (!Number.isSafeInteger(amountMinor)) {
		throw new TypeError('Money minor units must be a safe integer');
	}
}

function validateTransactionInput(input: CreateTransactionInput): void {
	assertSafeMinorUnits(input.amountMinor);
	validateDate(input.transactionDate);
	if (input.payee !== undefined && input.payee.length > 120) {
		throw new Error('Payee must be at most 120 characters');
	}
	if (input.memo !== undefined && input.memo.length > 500) {
		throw new Error('Memo must be at most 500 characters');
	}

	const parts = input.parts ?? [];
	let sum = 0n;
	for (const part of parts) {
		assertSafeMinorUnits(part.amountMinor);
		if (part.memo !== undefined && part.memo.length > 500) {
			throw new Error('Transaction part memo must be at most 500 characters');
		}
		sum += BigInt(part.amountMinor);
	}
	if (parts.length > 0 && sum !== BigInt(input.amountMinor)) {
		throw new Error('Transaction parts must sum to the transaction amount');
	}
}

function validateTransferInput(input: CreateTransferInput): void {
	assertSafeMinorUnits(input.amountMinor);
	validateDate(input.transactionDate);
	if (input.amountMinor <= 0) {
		throw new Error('Transfer amount must be greater than zero');
	}
	if (input.fromAccountId === input.toAccountId) {
		throw new Error('Transfer accounts must be different');
	}
	if (input.memo !== undefined && input.memo.length > 500) {
		throw new Error('Memo must be at most 500 characters');
	}
}

function validateDate(value: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error('Transaction date must use YYYY-MM-DD format');
	}
	const date = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
		throw new Error('Transaction date must be a valid calendar date');
	}
}

export {
	assertSafeMinorUnits,
	type CreateTransactionInput,
	type CreateTransferInput,
	type FinancialTransaction,
	type LedgerRepository,
	TRANSACTION_STATUS,
	type TransactionPart,
	type TransactionPartInput,
	type TransactionStatus,
	type UpdateTransactionInput,
	validateDate,
	validateTransactionInput,
	validateTransferInput,
};
