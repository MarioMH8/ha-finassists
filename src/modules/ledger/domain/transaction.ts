import {
	TransactionAmountInvalidError,
	TransactionDateCalendarInvalidError,
	TransactionDateFormatInvalidError,
	TransactionDescriptionTooLongError,
	TransactionKindInvalidError,
} from './transaction.error';

const TRANSACTION_KIND = { EXPENSE: 'expense', INCOME: 'income' } as const;

type TransactionKind = (typeof TRANSACTION_KIND)[keyof typeof TRANSACTION_KIND];

const TRANSACTION_KINDS: readonly TransactionKind[] = Object.values(TRANSACTION_KIND);

const DESCRIPTION_MAX_LENGTH = 200;

interface TransactionProperties {
	actorId: null | string;
	amountMinor: number;
	createdAt: string;
	currencyCode: string;
	description: string;
	id: string;
	kind: TransactionKind;
	transactionDate: string;
}

function isCalendarDate(value: string): boolean {
	const parsed = new Date(`${value}T00:00:00.000Z`);

	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

class Transaction {
	private constructor(
		readonly id: string,
		readonly kind: TransactionKind,
		readonly amountMinor: number,
		readonly currencyCode: string,
		readonly description: string,
		readonly transactionDate: string,
		readonly actorId: null | string,
		readonly createdAt: string
	) {}

	static create(properties: TransactionProperties): Transaction {
		if (!TRANSACTION_KINDS.includes(properties.kind)) {
			throw new TransactionKindInvalidError();
		}
		if (!Number.isSafeInteger(properties.amountMinor) || properties.amountMinor <= 0) {
			throw new TransactionAmountInvalidError();
		}
		if (!/^\d{4}-\d{2}-\d{2}$/u.test(properties.transactionDate)) {
			throw new TransactionDateFormatInvalidError();
		}
		if (!isCalendarDate(properties.transactionDate)) {
			throw new TransactionDateCalendarInvalidError();
		}
		const description = properties.description.trim();
		if (description.length > DESCRIPTION_MAX_LENGTH) {
			throw new TransactionDescriptionTooLongError(DESCRIPTION_MAX_LENGTH);
		}

		return new Transaction(
			properties.id,
			properties.kind,
			properties.amountMinor,
			properties.currencyCode,
			description,
			properties.transactionDate,
			properties.actorId,
			properties.createdAt
		);
	}
}

export {
	DESCRIPTION_MAX_LENGTH,
	Transaction,
	TRANSACTION_KIND,
	TRANSACTION_KINDS,
	type TransactionKind,
	type TransactionProperties,
};
