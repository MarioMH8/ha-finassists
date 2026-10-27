import { CalendarDate } from './calendar-date';
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
	categoryId: null | string | undefined;
	createdAt: string;
	currencyCode: string;
	description: string;
	id: string;
	kind: TransactionKind;
	transactionDate: string;
}

class Transaction {
	private constructor(
		readonly id: string,
		readonly kind: TransactionKind,
		readonly amountMinor: number,
		readonly currencyCode: string,
		readonly description: string,
		readonly transactionDate: string,
		readonly categoryId: null | string,
		readonly actorId: null | string,
		readonly createdAt: string
	) {}

	static create(properties: TransactionProperties): Transaction {
		if (!this.isKind(properties.kind)) {
			throw new TransactionKindInvalidError();
		}
		if (!Number.isSafeInteger(properties.amountMinor) || properties.amountMinor <= 0) {
			throw new TransactionAmountInvalidError();
		}
		if (!/^\d{4}-\d{2}-\d{2}$/u.test(properties.transactionDate)) {
			throw new TransactionDateFormatInvalidError();
		}
		if (!CalendarDate.isValid(properties.transactionDate)) {
			throw new TransactionDateCalendarInvalidError();
		}
		const description = properties.description.trim();
		if (description.length > DESCRIPTION_MAX_LENGTH) {
			throw new TransactionDescriptionTooLongError(DESCRIPTION_MAX_LENGTH);
		}
		// The ledger stores an absent category as JSON and SQL null, not as undefined.
		// eslint-disable-next-line unicorn/no-null
		const categoryId = properties.categoryId ?? null;

		return new Transaction(
			properties.id,
			properties.kind,
			properties.amountMinor,
			properties.currencyCode,
			description,
			properties.transactionDate,
			categoryId,
			properties.actorId,
			properties.createdAt
		);
	}

	static isKind(value: string): value is TransactionKind {
		return (TRANSACTION_KINDS as readonly string[]).includes(value);
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
