import type { Currency } from '@modules/money/domain';
import { Money } from '@modules/money/domain';

import {
	AccountAlreadyClosedError,
	AccountBalanceOutOfRangeError,
	AccountBookIdInvalidError,
	AccountIdInvalidError,
	AccountKindInvalidError,
	AccountNameInvalidError,
	AccountNotClosedError,
	AccountOpeningBalanceInvalidError,
} from './account.error';

const ACCOUNT_KINDS = {
	ASSET: 'asset',
	CHECKING: 'checking',
	CREDIT: 'credit',
	LIABILITY: 'liability',
	SAVINGS: 'savings',
} as const;
const ACCOUNT_KIND_VALUES = Object.values(ACCOUNT_KINDS);
const OPEN_ACCOUNT = JSON.parse('null') as null;

type AccountKind = (typeof ACCOUNT_KINDS)[keyof typeof ACCOUNT_KINDS];

interface AccountInput {
	bookId: string;
	closedAt?: null | string;
	createdAt?: string;
	id: string;
	kind: string;
	name: string;
	openingBalanceMinor: number;
}

interface PersistedAccountInput extends AccountInput {
	closedAt: null | string;
	createdAt: string;
}

interface TransactionTotals {
	cleared: number;
	reconciled: number;
	uncleared: number;
}

interface AccountBalances {
	posted: Money;
	reconciled: Money;
	total: Money;
}

class Account {
	private constructor(
		readonly bookId: string,
		readonly closedAt: null | string,
		readonly createdAt: string,
		readonly id: string,
		readonly kind: AccountKind,
		readonly name: string,
		readonly openingBalanceMinor: number
	) {}

	static create(input: AccountInput): Account {
		const name = input.name.trim();
		if (name.length === 0 || name.length > 80) {
			throw new AccountNameInvalidError();
		}

		if (input.id.trim().length === 0) {
			throw new AccountIdInvalidError();
		}

		if (input.bookId.trim().length === 0) {
			throw new AccountBookIdInvalidError();
		}

		const kind = ACCOUNT_KIND_VALUES.find(accountKind => accountKind === input.kind);
		if (!kind) {
			throw new AccountKindInvalidError(ACCOUNT_KIND_VALUES);
		}

		if (!Number.isSafeInteger(input.openingBalanceMinor)) {
			throw new AccountOpeningBalanceInvalidError();
		}

		return new this(
			input.bookId,
			input.closedAt ?? OPEN_ACCOUNT,
			input.createdAt ?? new Date().toISOString(),
			input.id,
			kind,
			name,
			input.openingBalanceMinor
		);
	}

	static restore(input: PersistedAccountInput): Account {
		return this.create(input);
	}

	balances(totals: TransactionTotals, currency: Currency): AccountBalances {
		if (Object.values(totals).some(total => !Number.isSafeInteger(total))) {
			throw new AccountBalanceOutOfRangeError(this.id);
		}

		const reconciled = this.toSafeMinorUnits(BigInt(this.openingBalanceMinor) + BigInt(totals.reconciled));
		const posted = this.toSafeMinorUnits(BigInt(reconciled) + BigInt(totals.cleared));
		const total = this.toSafeMinorUnits(BigInt(posted) + BigInt(totals.uncleared));

		return {
			posted: Money.fromMinor(posted, currency),
			reconciled: Money.fromMinor(reconciled, currency),
			total: Money.fromMinor(total, currency),
		};
	}

	close(closedAt: string): Account {
		if (this.closedAt !== OPEN_ACCOUNT) {
			throw new AccountAlreadyClosedError(this.id);
		}

		return this.withClosedAt(closedAt);
	}

	reopen(): Account {
		if (this.closedAt === OPEN_ACCOUNT) {
			throw new AccountNotClosedError(this.id);
		}

		return this.withClosedAt(OPEN_ACCOUNT);
	}

	private toSafeMinorUnits(value: bigint): number {
		const amount = Number(value);
		if (!Number.isSafeInteger(amount)) {
			throw new AccountBalanceOutOfRangeError(this.id);
		}

		return amount;
	}

	private withClosedAt(closedAt: null | string): Account {
		return Account.create({
			bookId: this.bookId,
			closedAt,
			createdAt: this.createdAt,
			id: this.id,
			kind: this.kind,
			name: this.name,
			openingBalanceMinor: this.openingBalanceMinor,
		});
	}
}

export {
	Account,
	ACCOUNT_KINDS,
	type AccountBalances,
	type AccountInput,
	type AccountKind,
	type PersistedAccountInput,
	type TransactionTotals,
};
