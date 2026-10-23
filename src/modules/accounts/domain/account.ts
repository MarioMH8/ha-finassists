import type { Currency } from '@modules/money/domain';
import { Money } from '@modules/money/domain';

const ACCOUNT_KINDS = ['checking', 'savings', 'credit', 'asset', 'liability'] as const;
const JSON_NULL = JSON.parse('null') as null;

type AccountKind = (typeof ACCOUNT_KINDS)[number];

interface AccountInput {
	bookId: string;
	closedAt?: null | string;
	createdAt?: string;
	currency: Currency;
	id: string;
	kind: string;
	name: string;
	openingBalanceMinor: number;
}

interface Account {
	bookId: string;
	closedAt: null | string;
	createdAt: string;
	id: string;
	kind: AccountKind;
	name: string;
	openingBalanceMinor: number;
}

function isAccountKind(value: string): value is AccountKind {
	return (ACCOUNT_KINDS as readonly string[]).includes(value);
}

function createAccount(input: AccountInput): Account {
	const name = input.name.trim();
	if (name.length === 0 || name.length > 80) {
		throw new Error('Account name must contain between 1 and 80 characters');
	}

	if (input.id.trim().length === 0) {
		throw new Error('Account id must not be empty');
	}

	if (input.bookId.trim().length === 0) {
		throw new Error('Account book id must not be empty');
	}

	if (!isAccountKind(input.kind)) {
		throw new Error(`Account kind must be one of: ${ACCOUNT_KINDS.join(', ')}`);
	}

	return {
		bookId: input.bookId,
		closedAt: input.closedAt ?? JSON_NULL,
		createdAt: input.createdAt ?? new Date().toISOString(),
		id: input.id,
		kind: input.kind,
		name,
		openingBalanceMinor: Money.fromMinor(input.openingBalanceMinor, input.currency).minorUnits,
	};
}

export { type Account, ACCOUNT_KINDS, type AccountInput, type AccountKind, createAccount };
