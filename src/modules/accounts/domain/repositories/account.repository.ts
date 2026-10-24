import type { Account, AccountKind } from '@modules/accounts/domain/account';

interface AccountCriteria {
	bookId?: string;
	closed?: boolean;
	createdAt?: string;
	id?: string;
	kind?: AccountKind;
	name?: string;
	openingBalanceMinor?: number;
}

interface AccountDeleteCriteria {
	bookId: string;
	id: string;
}

interface AccountRepository {
	delete(criteria: AccountDeleteCriteria): boolean;
	find(criteria: AccountCriteria): Account | undefined;
	save(account: Account): void;
	search(criteria?: AccountCriteria): Account[];
}

export type { AccountCriteria, AccountDeleteCriteria, AccountRepository };
